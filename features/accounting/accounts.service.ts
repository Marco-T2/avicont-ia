import {
  NotFoundError,
  ConflictError,
  ValidationError,
  INVALID_ACCOUNT_NATURE,
  ACCOUNT_TYPE_MISMATCH,
  MAX_ACCOUNT_DEPTH_EXCEEDED,
  INVALID_ACCOUNT_CODE_PREFIX,
} from "@/features/shared/errors";
import { AccountsRepository, type AccountListFilters } from "./accounts.repository";
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

  // ── Listar todas las cuentas ──

  async list(organizationId: string, filters?: AccountListFilters): Promise<Account[]> {
    return this.repo.findAll(organizationId, filters);
  }

  // ── Obtener el árbol completo de cuentas ──

  async getTree(organizationId: string): Promise<AccountWithChildren[]> {
    return this.repo.findTree(organizationId);
  }

  // ── Obtener una cuenta por ID ──

  async getById(organizationId: string, id: string): Promise<Account> {
    const account = await this.repo.findById(organizationId, id);
    if (!account) throw new NotFoundError("Cuenta");
    return account;
  }

  // ── Crear una cuenta ──

  async create(organizationId: string, input: CreateAccountInput): Promise<Account> {
    // 1. Resolver la cuenta padre
    let parent: Account | null = null;
    if (input.parentId) {
      parent = await this.repo.findById(organizationId, input.parentId);
      if (!parent) throw new NotFoundError("Cuenta padre");
    }

    // 2. Calcular el nivel
    const level = parent ? parent.level + 1 : 1;

    // 3. Validar la profundidad máxima
    if (level > MAX_DEPTH) {
      throw new ValidationError(
        `No se pueden crear cuentas con más de ${MAX_DEPTH} niveles de profundidad`,
        MAX_ACCOUNT_DEPTH_EXCEEDED,
      );
    }

    // 4. Resolver el tipo (heredar del padre o requerir para cuentas raíz)
    const type = input.type ?? parent?.type;
    if (!type) {
      throw new ValidationError(
        "El tipo de cuenta es requerido para cuentas raíz",
      );
    }

    // 5. Validar coherencia del tipo con la cuenta padre
    if (parent && input.type && input.type !== parent.type) {
      throw new ValidationError(
        `El tipo de cuenta debe coincidir con la cuenta padre (${parent.type})`,
        ACCOUNT_TYPE_MISMATCH,
      );
    }

    // 6. Derivar la naturaleza
    const nature = deriveNature(type);
    if (input.nature !== undefined && input.nature !== nature) {
      throw new ValidationError(
        `La naturaleza de la cuenta no coincide con el tipo '${type}'. Naturaleza esperada: ${nature}`,
        INVALID_ACCOUNT_NATURE,
      );
    }

    // 7. Resolver el código (auto-generar o validar el manual)
    let code: string;
    if (input.code) {
      // Código manual — validar que el prefijo coincida con el padre
      if (parent && !input.code.startsWith(parent.code + ".")) {
        throw new ValidationError(
          `El código debe comenzar con "${parent.code}." para ser subcuenta de ${parent.name}`,
          INVALID_ACCOUNT_CODE_PREFIX,
        );
      }
      // Verificar unicidad
      const existing = await this.repo.findByCode(organizationId, input.code);
      if (existing) throw new ConflictError("Cuenta con ese código");
      code = input.code;
    } else {
      // Auto-generar
      const siblings = await this.repo.findSiblings(organizationId, input.parentId ?? null);
      code = getNextCode(parent?.code ?? null, siblings.map((s) => s.code));
      // Verificar unicidad (protección ante condición de carrera)
      const existing = await this.repo.findByCode(organizationId, code);
      if (existing) throw new ConflictError("Cuenta con ese código");
    }

    // 8. Valor por defecto de isDetail
    const isDetail = input.isDetail ?? true;

    // 9. Construir los datos resueltos
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

    // 10. Crear la cuenta + cambiar isDetail del padre si es necesario (atómico)
    if (parent && parent.isDetail) {
      return this.repo.transaction(async (tx) => {
        await this.repo.update(organizationId, parent!.id, { isDetail: false }, tx);
        return this.repo.create(organizationId, resolved, tx);
      });
    }

    return this.repo.create(organizationId, resolved);
  }

  // ── Actualizar una cuenta ──

  async update(organizationId: string, id: string, input: UpdateAccountInput): Promise<Account> {
    const account = await this.repo.findById(organizationId, id);
    if (!account) throw new NotFoundError("Cuenta");

    return this.repo.update(organizationId, id, input);
  }

  // ── Desactivar una cuenta ──

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
