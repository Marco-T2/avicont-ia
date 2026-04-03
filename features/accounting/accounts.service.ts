import { NotFoundError, ConflictError, ValidationError } from "@/features/shared/errors";
import { AccountsRepository } from "./accounts.repository";
import type { Account } from "@/generated/prisma/client";
import type { CreateAccountInput, UpdateAccountInput, AccountWithChildren } from "./accounts.types";

export class AccountsService {
  private readonly repo: AccountsRepository;

  constructor(repo?: AccountsRepository) {
    this.repo = repo ?? new AccountsRepository();
  }

  // ── List all accounts ──

  async list(organizationId: string): Promise<Account[]> {
    return this.repo.findAll(organizationId);
  }

  // ── Get full account tree ──

  async getTree(organizationId: string): Promise<AccountWithChildren[]> {
    return this.repo.findTree(organizationId);
  }

  // ── Get a single account ──

  async getById(organizationId: string, id: string): Promise<Account> {
    const account = await this.repo.findById(organizationId, id);
    if (!account) throw new NotFoundError("Cuenta");
    return account;
  }

  // ── Create an account ──

  async create(organizationId: string, input: CreateAccountInput): Promise<Account> {
    const existing = await this.repo.findByCode(organizationId, input.code);
    if (existing) throw new ConflictError("Cuenta con ese código");

    if (input.parentId) {
      const parent = await this.repo.findById(organizationId, input.parentId);
      if (!parent) throw new NotFoundError("Cuenta padre");
    }

    return this.repo.create(organizationId, input);
  }

  // ── Update an account ──

  async update(organizationId: string, id: string, input: UpdateAccountInput): Promise<Account> {
    const account = await this.repo.findById(organizationId, id);
    if (!account) throw new NotFoundError("Cuenta");

    return this.repo.update(organizationId, id, input);
  }

  // ── Deactivate an account ──

  async deactivate(organizationId: string, id: string): Promise<Account> {
    const account = await this.repo.findById(organizationId, id);
    if (!account) throw new NotFoundError("Cuenta");

    const activeChildren = await this.repo.findActiveChildren(organizationId, id);
    if (activeChildren.length > 0) {
      throw new ValidationError("No se puede desactivar una cuenta con subcuentas activas");
    }

    return this.repo.deactivate(organizationId, id);
  }
}
