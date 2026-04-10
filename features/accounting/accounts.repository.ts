import { BaseRepository } from "@/features/shared/base.repository";
import type { Prisma, Account, AccountType, AccountNature } from "@/generated/prisma/client";
import type { ResolvedCreateAccountData, UpdateAccountInput, AccountWithChildren } from "./accounts.types";

export class AccountsRepository extends BaseRepository {
  async findAll(organizationId: string): Promise<Account[]> {
    const scope = this.requireOrg(organizationId);

    return this.db.account.findMany({
      where: scope,
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

  async findTree(organizationId: string): Promise<AccountWithChildren[]> {
    const scope = this.requireOrg(organizationId);

    return this.db.account.findMany({
      where: scope,
      include: { children: true },
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
        parentId: data.parentId,
        level: data.level,
        isDetail: data.isDetail,
        requiresContact: data.requiresContact,
        description: data.description,
        organizationId: scope.organizationId,
      },
    });
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
    return this.db.account.findMany({
      where: {
        ...scope,
        isDetail: true,
        isActive: true,
        OR: parentCodes.map((code) => ({
          code: { startsWith: `${code}.` },
        })),
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
