/**
 * Domain port for accounts CRUD aggregate (§13.X canonical-home rule:
 * domain ports live in `modules/accounting/domain/ports/`).
 *
 * Interface-only — no runtime code. Cements the 15-method surface that
 * adapter (#3b PrismaAccountsRepo), app-service (#3c), routes (#3d),
 * and cross-module consumers (#3e) will bind against.
 *
 * Paired-sister precedent: `accounts-read.port.ts` (JSDoc style, import style).
 *
 * tx pattern: Pattern C (UoW construction-time) for normal hex use.
 * Seed + write methods use `tx?: unknown` opaque — no Prisma leakage into port
 * surface (payment-module precedent: the adapter casts internally).
 */

import type { Account, AccountType } from "@/generated/prisma/client";
import type {
  AccountListFilters,
  ResolvedCreateAccountData,
  UpdateAccountInput,
  AccountWithChildren,
} from "@/modules/accounting/presentation/dto/accounts.types";
import type { AccountDef } from "@/prisma/seeds/chart-of-accounts";

export interface AccountsCrudPort {
  // ── Reads (10) ─────────────────────────────────────────────────────────────

  /** Returns all accounts for an org, optionally filtered by type/subtype/isDetail/isActive. */
  findAll(
    organizationId: string,
    filters?: AccountListFilters,
  ): Promise<Account[]>;

  /** Returns account by id within org, or null if not found. */
  findById(organizationId: string, id: string): Promise<Account | null>;

  /** Returns account by code within org, or null if not found. */
  findByCode(organizationId: string, code: string): Promise<Account | null>;

  /** Returns multiple accounts by ids. Returns [] when ids is empty. */
  findManyByIds(organizationId: string, ids: string[]): Promise<Account[]>;

  /**
   * Returns the full account tree (root nodes with nested children).
   * AccountWithChildren shape preserved verbatim from legacy — normalization
   * deferred to future POC to avoid breaking UI consumers.
   */
  findTree(organizationId: string): Promise<AccountWithChildren[]>;

  /** Returns all accounts of the given type, ordered by code asc. */
  findByType(
    organizationId: string,
    type: AccountType,
  ): Promise<Account[]>;

  /**
   * Returns sibling account codes (only `code` field) under the same parent.
   * Pick<Account, "code">[] — NOT Account[] (matches legacy select: { code: true }).
   */
  findSiblings(
    organizationId: string,
    parentId: string | null,
  ): Promise<Pick<Account, "code">[]>;

  /** Returns all active detail accounts, ordered by code asc. */
  findDetailAccounts(organizationId: string): Promise<Account[]>;

  /**
   * Returns active detail accounts that are descendants of the given parent codes,
   * including the parent codes themselves when they are already detail accounts.
   */
  findDetailChildrenByParentCodes(
    organizationId: string,
    parentCodes: string[],
  ): Promise<Account[]>;

  /** Returns active direct children of the given parent account. */
  findActiveChildren(
    organizationId: string,
    parentId: string,
  ): Promise<Account[]>;

  // ── Writes (3) ─────────────────────────────────────────────────────────────

  /** Creates a new account. Accepts optional tx for UoW composition. */
  create(
    organizationId: string,
    data: ResolvedCreateAccountData,
    tx?: unknown,
  ): Promise<Account>;

  /** Updates an existing account. Accepts optional tx for UoW composition. */
  update(
    organizationId: string,
    id: string,
    data: UpdateAccountInput,
    tx?: unknown,
  ): Promise<Account>;

  /**
   * Seeds a chart of accounts for the org. Idempotent (upsert by organizationId+code).
   * Input MUST be ordered parents before children (FK violations otherwise — fail-loud by design).
   */
  seedChartOfAccounts(
    organizationId: string,
    accounts: readonly AccountDef[],
    tx?: unknown,
  ): Promise<void>;

  // ── Lifecycle (1) ──────────────────────────────────────────────────────────

  /** Soft-deactivates an account (isActive = false). */
  deactivate(organizationId: string, id: string): Promise<Account>;

  // ── Cross-aggregate (1) ────────────────────────────────────────────────────

  // TODO: move to AccountUsagePort when journal hex migrates
  countJournalLines(
    organizationId: string,
    accountId: string,
  ): Promise<number>;
}
