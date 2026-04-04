import { BaseRepository } from "@/features/shared/base.repository";
import type { Account, AccountType } from "@/generated/prisma/client";
import type { CreateAccountInput, UpdateAccountInput, AccountWithChildren } from "./accounts.types";

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

  async create(organizationId: string, data: CreateAccountInput): Promise<Account> {
    const scope = this.requireOrg(organizationId);

    return this.db.account.create({
      data: {
        code: data.code,
        name: data.name,
        type: data.type,
        parentId: data.parentId ?? null,
        level: data.level,
        organizationId: scope.organizationId,
      },
    });
  }

  async update(organizationId: string, id: string, data: UpdateAccountInput): Promise<Account> {
    const scope = this.requireOrg(organizationId);

    return this.db.account.update({
      where: { id, ...scope },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
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
}
