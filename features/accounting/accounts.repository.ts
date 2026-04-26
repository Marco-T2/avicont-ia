import "server-only";
import { BaseRepository } from "@/features/shared/base.repository";
import {
  type AccountDef,
  deriveNature,
} from "@/prisma/seeds/chart-of-accounts";
import type { Prisma, Account, AccountType, AccountSubtype } from "@/generated/prisma/client";
import type { ResolvedCreateAccountData, UpdateAccountInput, AccountWithChildren } from "./accounts.types";

export interface AccountListFilters {
  type?: AccountType;
  /** Filtro por subtipo de cuenta (corriente, no corriente, operativo, etc.). */
  subtype?: AccountSubtype;
  isDetail?: boolean;
  isActive?: boolean;
}

export class AccountsRepository extends BaseRepository {
  async findAll(organizationId: string, filters?: AccountListFilters): Promise<Account[]> {
    const scope = this.requireOrg(organizationId);

    return this.db.account.findMany({
      where: {
        ...scope,
        ...(filters?.type !== undefined && { type: filters.type }),
        ...(filters?.subtype !== undefined && { subtype: filters.subtype }),
        ...(filters?.isDetail !== undefined && { isDetail: filters.isDetail }),
        ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
      },
      orderBy: { code: "asc" },
    });
  }

  async findById(organizationId: string, id: string): Promise<Account | null> {
    const scope = this.requireOrg(organizationId);

    return this.db.account.findFirst({
      where: { id, ...scope },
    });
  }

  async findByCode(organizationId: string, code: string): Promise<Account | null> {
    const scope = this.requireOrg(organizationId);

    return this.db.account.findFirst({
      where: { code, ...scope },
    });
  }

  async findManyByIds(organizationId: string, ids: string[]): Promise<Account[]> {
    if (ids.length === 0) return [];
    const scope = this.requireOrg(organizationId);

    return this.db.account.findMany({
      where: { id: { in: ids }, ...scope },
    });
  }

  async findTree(organizationId: string): Promise<AccountWithChildren[]> {
    const scope = this.requireOrg(organizationId);

    return this.db.account.findMany({
      where: { ...scope, parentId: null },
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

  async findByType(organizationId: string, type: AccountType): Promise<Account[]> {
    const scope = this.requireOrg(organizationId);

    return this.db.account.findMany({
      where: { type, ...scope },
      orderBy: { code: "asc" },
    });
  }

  async findSiblings(
    organizationId: string,
    parentId: string | null,
  ): Promise<Pick<Account, "code">[]> {
    const scope = this.requireOrg(organizationId);

    return this.db.account.findMany({
      where: { ...scope, parentId: parentId ?? null },
      select: { code: true },
      orderBy: { code: "asc" },
    });
  }

  async create(
    organizationId: string,
    data: ResolvedCreateAccountData,
    tx?: Prisma.TransactionClient,
  ): Promise<Account> {
    const scope = this.requireOrg(organizationId);
    const client = tx ?? this.db;

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
        organizationId: scope.organizationId,
      },
    });
  }

  /**
   * Sembrar un plan de cuentas para la organización. Idempotente: usa upsert
   * por la unique compuesta (organizationId, code), por lo que reintentos no
   * duplican. Resuelve `parentId` con un `Map<code, id>` poblado en orden
   * topológico — el array de entrada DEBE estar ordenado padres antes que
   * hijos (FK violations si no, fail-loud por design).
   */
  async seedChartOfAccounts(
    organizationId: string,
    accounts: readonly AccountDef[],
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const scope = this.requireOrg(organizationId);
    const client = tx ?? this.db;

    const codeToId = new Map<string, string>();

    for (const acct of accounts) {
      const parentId = acct.parentCode
        ? codeToId.get(acct.parentCode) ?? null
        : null;
      const isContraAccount = acct.isContraAccount ?? false;
      const nature = deriveNature(acct.type, isContraAccount);

      const created = await client.account.upsert({
        where: {
          organizationId_code: {
            organizationId: scope.organizationId,
            code: acct.code,
          },
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
          organizationId: scope.organizationId,
          isActive: true,
          isContraAccount,
        },
        update: {},
      });

      codeToId.set(acct.code, created.id);
    }
  }

  async update(
    organizationId: string,
    id: string,
    data: UpdateAccountInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Account> {
    const scope = this.requireOrg(organizationId);
    const client = tx ?? this.db;

    return client.account.update({
      where: { id, ...scope },
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

  async findDetailAccounts(organizationId: string): Promise<Account[]> {
    const scope = this.requireOrg(organizationId);

    return this.db.account.findMany({
      where: { ...scope, isDetail: true, isActive: true },
      orderBy: { code: "asc" },
    });
  }

  async findDetailChildrenByParentCodes(
    organizationId: string,
    parentCodes: string[],
  ): Promise<Account[]> {
    const scope = this.requireOrg(organizationId);
    // Devuelve cuentas de detalle bajo los parent codes Y los parent codes
    // mismos cuando ya son detail. El chart seedeado deja códigos como "1.1.1"
    // (Caja) como leaves directas — sin esto, orgs con el chart por defecto
    // sin sub-cuentas reciben listas vacías y los flujos que dependen de este
    // método (IA, pagos) muestran error de configuración.
    return this.db.account.findMany({
      where: {
        ...scope,
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

  async deactivate(organizationId: string, id: string): Promise<Account> {
    const scope = this.requireOrg(organizationId);

    return this.db.account.update({
      where: { id, ...scope },
      data: { isActive: false },
    });
  }

  async findActiveChildren(organizationId: string, parentId: string): Promise<Account[]> {
    const scope = this.requireOrg(organizationId);

    return this.db.account.findMany({
      where: { parentId, isActive: true, ...scope },
    });
  }

  async countJournalLines(organizationId: string, accountId: string): Promise<number> {
    return this.db.journalLine.count({
      where: {
        accountId,
        journalEntry: { organizationId },
      },
    });
  }
}
