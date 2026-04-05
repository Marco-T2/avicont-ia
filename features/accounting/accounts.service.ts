import {
  NotFoundError,
  ConflictError,
  ValidationError,
  INVALID_ACCOUNT_NATURE,
  ACCOUNT_TYPE_MISMATCH,
  MAX_ACCOUNT_DEPTH_EXCEEDED,
  INVALID_ACCOUNT_CODE_PREFIX,
} from "@/features/shared/errors";
import { AccountsRepository } from "./accounts.repository";
import { getNextCode } from "./account-code.utils";
import type { Account, AccountType, AccountNature } from "@/generated/prisma/client";
import type {
  CreateAccountInput,
  ResolvedCreateAccountData,
  UpdateAccountInput,
  AccountWithChildren,
} from "./accounts.types";

const MAX_DEPTH = 4;

function deriveNature(type: AccountType): AccountNature {
  return (type === "ACTIVO" || type === "GASTO") ? "DEUDORA" : "ACREEDORA";
}

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
    // 1. Resolve parent
    let parent: Account | null = null;
    if (input.parentId) {
      parent = await this.repo.findById(organizationId, input.parentId);
      if (!parent) throw new NotFoundError("Cuenta padre");
    }

    // 2. Calculate level
    const level = parent ? parent.level + 1 : 1;

    // 3. Validate max depth
    if (level > MAX_DEPTH) {
      throw new ValidationError(
        `No se pueden crear cuentas con más de ${MAX_DEPTH} niveles de profundidad`,
        MAX_ACCOUNT_DEPTH_EXCEEDED,
      );
    }

    // 4. Resolve type (inherit from parent or require for root)
    const type = input.type ?? parent?.type;
    if (!type) {
      throw new ValidationError(
        "El tipo de cuenta es requerido para cuentas raíz",
      );
    }

    // 5. Validate type consistency with parent
    if (parent && input.type && input.type !== parent.type) {
      throw new ValidationError(
        `El tipo de cuenta debe coincidir con la cuenta padre (${parent.type})`,
        ACCOUNT_TYPE_MISMATCH,
      );
    }

    // 6. Derive nature
    const nature = deriveNature(type);
    if (input.nature !== undefined && input.nature !== nature) {
      throw new ValidationError(
        `La naturaleza de la cuenta no coincide con el tipo '${type}'. Naturaleza esperada: ${nature}`,
        INVALID_ACCOUNT_NATURE,
      );
    }

    // 7. Resolve code (auto-generate or validate manual)
    let code: string;
    if (input.code) {
      // Manual code — validate prefix matches parent
      if (parent && !input.code.startsWith(parent.code + ".")) {
        throw new ValidationError(
          `El código debe comenzar con "${parent.code}." para ser subcuenta de ${parent.name}`,
          INVALID_ACCOUNT_CODE_PREFIX,
        );
      }
      // Check uniqueness
      const existing = await this.repo.findByCode(organizationId, input.code);
      if (existing) throw new ConflictError("Cuenta con ese código");
      code = input.code;
    } else {
      // Auto-generate
      const siblings = await this.repo.findSiblings(organizationId, input.parentId ?? null);
      code = getNextCode(parent?.code ?? null, siblings.map((s) => s.code));
      // Verify uniqueness (race condition guard)
      const existing = await this.repo.findByCode(organizationId, code);
      if (existing) throw new ConflictError("Cuenta con ese código");
    }

    // 8. Default isDetail
    const isDetail = input.isDetail ?? true;

    // 9. Build resolved data
    const resolved: ResolvedCreateAccountData = {
      code,
      name: input.name,
      type,
      nature,
      parentId: input.parentId ?? null,
      level,
      isDetail,
      requiresContact: input.requiresContact ?? false,
      description: input.description ?? null,
    };

    // 10. Create account + flip parent isDetail if needed (atomic)
    if (parent && parent.isDetail) {
      return this.repo.transaction(async (tx) => {
        await this.repo.update(organizationId, parent!.id, { isDetail: false }, tx);
        return this.repo.create(organizationId, resolved, tx);
      });
    }

    return this.repo.create(organizationId, resolved);
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

    if (account.level <= 2) {
      throw new ValidationError("No se pueden desactivar cuentas de nivel 1 o 2 (cuentas estructurales)");
    }

    const activeChildren = await this.repo.findActiveChildren(organizationId, id);
    if (activeChildren.length > 0) {
      throw new ValidationError("No se puede desactivar una cuenta con subcuentas activas");
    }

    const movementCount = await this.repo.countJournalLines(organizationId, id);
    if (movementCount > 0) {
      throw new ValidationError(
        `No se puede desactivar una cuenta con ${movementCount} movimiento(s) registrado(s)`,
      );
    }

    return this.repo.deactivate(organizationId, id);
  }
}
