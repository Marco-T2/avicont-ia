/**
 * Prisma adapter for `AccountsCrudPort` (POC #3b, §13.X canonical-home
 * `infrastructure/`). Mirror legacy `features/accounting/accounts.repository.ts`
 * bit-exact via Prisma queries directas — NO wrap-thin shim. Paired-sister
 * precedent: `PrismaSaleRepository` / `PrismaPurchaseRepository` (constructor
 * `Pick<PrismaClient,…>=prisma`); tx pattern inline `as Prisma.TransactionClient`
 * (payment precedent). `findActiveChildren` excluded from port surface fix 15
 * métodos (#3a lock); legacy method preserved untouched.
 */

import {
  Prisma,
  type PrismaClient,
  type Account,
  type AccountType,
} from "@/generated/prisma/client";
import { deriveNature, type AccountDef } from "@/prisma/seeds/chart-of-accounts";
import type {
  AccountListFilters,
  ResolvedCreateAccountData,
  UpdateAccountInput,
  AccountWithChildren,
} from "@/modules/accounting/presentation/dto/accounts.types";
import type { AccountsCrudPort } from "../domain/ports/accounts-crud.port";
import { prisma } from "@/lib/prisma";

type DbClient = Pick<PrismaClient, "account" | "journalLine">;

export class PrismaAccountsRepo implements AccountsCrudPort {
  constructor(private readonly db: DbClient = prisma) {}

  // ── Reads ────────────────────────────────────────────────────────────────

  /**
   * Returns all accounts for an org, optionally filtered by type/subtype/isDetail/isActive.
   * Spreads only defined filter keys into the Prisma where clause (no undefined leakage).
   */
  async findAll(
    organizationId: string,
    filters?: AccountListFilters,
  ): Promise<Account[]> {
    return this.db.account.findMany({
      where: {
        organizationId,
        ...(filters?.type !== undefined && { type: filters.type }),
        ...(filters?.subtype !== undefined && { subtype: filters.subtype }),
        ...(filters?.isDetail !== undefined && { isDetail: filters.isDetail }),
        ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
      },
      orderBy: { code: "asc" },
    });
  }

  /** Returns account by id within org, or null if not found. */
  async findById(organizationId: string, id: string): Promise<Account | null> {
    return this.db.account.findFirst({
      where: { id, organizationId },
    });
  }

  /** Returns account by code within org, or null if not found. */
  async findByCode(organizationId: string, code: string): Promise<Account | null> {
    return this.db.account.findFirst({
      where: { code, organizationId },
    });
  }

  /** Returns multiple accounts by ids. Returns [] when ids is empty (early-return guard). */
  async findManyByIds(organizationId: string, ids: string[]): Promise<Account[]> {
    if (ids.length === 0) return [];
    return this.db.account.findMany({
      where: { id: { in: ids }, organizationId },
    });
  }

  /**
   * Returns full account tree (root nodes with nested children, 4 levels deep).
   * AccountWithChildren shape preserved verbatim from legacy — normalization deferred.
   * Cast `as Promise<AccountWithChildren[]>` preserved from legacy (Prisma include inference limit).
   */
  async findTree(organizationId: string): Promise<AccountWithChildren[]> {
    return this.db.account.findMany({
      where: { organizationId, parentId: null },
      include: {
        children: {
          orderBy: { code: "asc" },
          include: {
            children: {
              orderBy: { code: "asc" },
              include: {
                children: {
                  orderBy: { code: "asc" },
                  include: { children: { orderBy: { code: "asc" } } },
                },
              },
            },
          },
        },
      },
      orderBy: { code: "asc" },
    }) as Promise<AccountWithChildren[]>;
  }

  /** Returns all accounts of the given type, ordered by code asc. */
  async findByType(
    organizationId: string,
    type: AccountType,
  ): Promise<Account[]> {
    return this.db.account.findMany({
      where: { type, organizationId },
      orderBy: { code: "asc" },
    });
  }

  /**
   * Returns sibling codes (only `code` field) under the same parent.
   * Returns Pick<Account, "code">[] — NOT Account[] (matches legacy select: { code: true }).
   */
  async findSiblings(
    organizationId: string,
    parentId: string | null,
  ): Promise<Pick<Account, "code">[]> {
    return this.db.account.findMany({
      where: { organizationId, parentId: parentId ?? null },
      select: { code: true },
      orderBy: { code: "asc" },
    });
  }

  /** Returns all active detail accounts, ordered by code asc. */
  async findDetailAccounts(organizationId: string): Promise<Account[]> {
    return this.db.account.findMany({
      where: { organizationId, isDetail: true, isActive: true },
      orderBy: { code: "asc" },
    });
  }

  /**
   * Returns active detail accounts under the given parent codes, including the parent codes
   * themselves when they are already detail. OR clause: descendants via startsWith + self-match via `in`.
   */
  async findDetailChildrenByParentCodes(
    organizationId: string,
    parentCodes: string[],
  ): Promise<Account[]> {
    // Returns detail accounts under the parent codes AND the parent codes
    // themselves when they are already detail. The seeded chart leaves codes
    // like "1.1.1" (Caja) as direct leaves — without this, orgs with the default
    // chart sin sub-accounts get empty lists and downstream flows (IA, payments)
    // surface configuration errors.
    return this.db.account.findMany({
      where: {
        organizationId,
        isDetail: true,
        isActive: true,
        OR: [
          ...parentCodes.map((code) => ({
            code: { startsWith: `${code}.` },
          })),
          { code: { in: parentCodes } },
        ],
      },
      orderBy: { code: "asc" },
    });
  }

  /** Returns active direct children of the given parent account. */
  async findActiveChildren(
    organizationId: string,
    parentId: string,
  ): Promise<Account[]> {
    return this.db.account.findMany({
      where: { parentId, isActive: true, organizationId },
    });
  }

  // ── Writes ───────────────────────────────────────────────────────────────

  /** Creates a new account. Accepts optional tx for UoW composition (inline cast — payment precedent). */
  async create(
    organizationId: string,
    data: ResolvedCreateAccountData,
    tx?: unknown,
  ): Promise<Account> {
    const client = tx != null ? (tx as Prisma.TransactionClient) : this.db;
    return client.account.create({
      data: {
        code: data.code,
        name: data.name,
        type: data.type,
        nature: data.nature,
        subtype: data.subtype,
        parentId: data.parentId,
        level: data.level,
        isDetail: data.isDetail,
        requiresContact: data.requiresContact,
        description: data.description,
        isContraAccount: data.isContraAccount,
        organizationId,
      },
    });
  }

  /**
   * Partially updates an account. Accepts optional tx for UoW composition.
   * Spreads only defined keys (sparse update — legacy parity).
   */
  async update(
    organizationId: string,
    id: string,
    data: UpdateAccountInput,
    tx?: unknown,
  ): Promise<Account> {
    const client = tx != null ? (tx as Prisma.TransactionClient) : this.db;
    return client.account.update({
      where: { id, organizationId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.isDetail !== undefined && { isDetail: data.isDetail }),
        ...(data.requiresContact !== undefined && { requiresContact: data.requiresContact }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.subtype !== undefined && { subtype: data.subtype }),
        // TODO(v2): reject isContraAccount flip without simultaneous nature update
        ...(data.isContraAccount !== undefined && { isContraAccount: data.isContraAccount }),
      },
    });
  }

  /**
   * Seeds a chart of accounts for the org. Idempotent (upsert on organizationId_code composite unique).
   * Input MUST be topologically ordered (parents before children) — FK violations otherwise, fail-loud by design.
   * Resolves parentId via codeToId Map populated in topological order. Accepts optional tx.
   */
  async seedChartOfAccounts(
    organizationId: string,
    accounts: readonly AccountDef[],
    tx?: unknown,
  ): Promise<void> {
    const client = tx != null ? (tx as Prisma.TransactionClient) : this.db;
    const codeToId = new Map<string, string>();

    for (const acct of accounts) {
      const parentId = acct.parentCode
        ? codeToId.get(acct.parentCode) ?? null
        : null;
      const isContraAccount = acct.isContraAccount ?? false;
      const nature = deriveNature(acct.type, isContraAccount);

      const created = await client.account.upsert({
        where: {
          organizationId_code: { organizationId, code: acct.code },
        },
        create: {
          code: acct.code,
          name: acct.name,
          type: acct.type,
          nature,
          subtype: acct.subtype,
          level: acct.level,
          isDetail: acct.isDetail,
          requiresContact: acct.requiresContact,
          parentId,
          organizationId,
          isActive: true,
          isContraAccount,
        },
        update: {},
      });

      codeToId.set(acct.code, created.id);
    }
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  /**
   * Soft-deactivates an account (isActive = false).
   * NO countJournalLines guard at repo layer — guard is in service layer (legacy parity, REQ-009).
   */
  async deactivate(organizationId: string, id: string): Promise<Account> {
    return this.db.account.update({
      where: { id, organizationId },
      data: { isActive: false },
    });
  }

  // ── Cross-aggregate ──────────────────────────────────────────────────────

  // TODO: move to AccountUsagePort when journal hex migrates
  /** Counts journal lines referencing the account within the org. */
  async countJournalLines(organizationId: string, accountId: string): Promise<number> {
    return this.db.journalLine.count({
      where: {
        accountId,
        journalEntry: { organizationId },
      },
    });
  }
}
