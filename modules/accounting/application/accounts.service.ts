/**
 * Hex application service for accounts CRUD aggregate (§13.X canonical-home: application/).
 *
 * Verbatim 1:1 behavior parity with legacy `features/accounting/accounts.service.ts` (225 LOC).
 * Binds against `AccountsCrudPort` (15 methods) — no Prisma leakage except the single
 * `$transaction` call for the atomic parent.isDetail flip (D3 lock: port has no .transaction()).
 *
 * NO `import "server-only"` — app-layer pure (JournalsService precedent at application/).
 *
 * Design locks: D1 (signature), D2 (method order), D3 (atomic tx), D5 (imports), D9 (decisions).
 * Paired-sister precedent: modules/payment/application/payments.service.ts (deps-object pattern).
 */

import {
  NotFoundError,
  ConflictError,
  ValidationError,
  INVALID_ACCOUNT_NATURE,
  ACCOUNT_TYPE_MISMATCH,
  MAX_ACCOUNT_DEPTH_EXCEEDED,
  INVALID_ACCOUNT_CODE_PREFIX,
} from "@/features/shared/errors";
import { getNextCode } from "@/modules/accounting/domain/account-code.utils";
import { resolveAccountSubtype } from "@/modules/accounting/domain/account-subtype.resolve";
import { ACCOUNTS } from "@/prisma/seeds/chart-of-accounts";
import type { Account, AccountType, AccountNature, PrismaClient } from "@/generated/prisma/client";
import type {
  AccountListFilters,
  CreateAccountInput,
  ResolvedCreateAccountData,
  UpdateAccountInput,
  AccountWithChildren,
} from "@/modules/accounting/presentation/dto/accounts.types";
import type { AccountsCrudPort } from "../domain/ports/accounts-crud.port";

// ── Inline constants ───────────────────────────────────────────────────────

const MAX_DEPTH = 4;

// ── Inline pure helper (legacy parity — not extracted to domain utils) ─────

function deriveNature(type: AccountType, isContraAccount = false): AccountNature {
  const defaultNature: AccountNature = (type === "ACTIVO" || type === "GASTO") ? "DEUDORA" : "ACREEDORA";
  if (!isContraAccount) return defaultNature;
  return defaultNature === "DEUDORA" ? "ACREEDORA" : "DEUDORA";
}

// ── Deps interface (D1 lock — prisma REQUIRED, not optional: DRIFT-1 vs spec) ─

/**
 * Deps injection bag for AccountsService.
 *
 * `prisma` is REQUIRED (not optional per spec REQ-02): the composition root
 * always provides it, and making it optional creates a runtime footgun in
 * the atomic `create` path (`this.prisma.$transaction` would crash with
 * undefined if omitted).
 *
 * `readonly` on both fields: immutability hygiene (DRIFT-3 vs payment precedent
 * which does NOT use readonly — locked here for hex layer consistency).
 */
export interface AccountsServiceDeps {
  readonly repo: AccountsCrudPort;
  readonly prisma: PrismaClient;
}

// ── Service ────────────────────────────────────────────────────────────────

export class AccountsService {
  private readonly repo: AccountsCrudPort;
  private readonly prisma: PrismaClient;

  constructor(deps: AccountsServiceDeps) {
    this.repo = deps.repo;
    this.prisma = deps.prisma;
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

  // ── Sembrar plan de cuentas inicial (al crear la organización) ──

  async seedChartOfAccounts(
    organizationId: string,
    tx?: unknown,
  ): Promise<void> {
    return this.repo.seedChartOfAccounts(organizationId, ACCOUNTS, tx);
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

    // 6. Derivar la naturaleza (respeta el flag de contra-cuenta si se indica)
    const isContraAccount = input.isContraAccount ?? false;
    const nature = deriveNature(type, isContraAccount);
    if (input.nature !== undefined && input.nature !== nature) {
      throw new ValidationError(
        `La naturaleza de la cuenta no coincide con el tipo '${type}'. Naturaleza esperada: ${nature}`,
        INVALID_ACCOUNT_NATURE,
      );
    }

    // 6b. Resolver el subtipo (herencia + validación)
    const subtype = resolveAccountSubtype({
      inputSubtype: input.subtype,
      parentSubtype: parent?.subtype ?? null,
      resolvedType: type,
      level,
    });

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
      subtype,
      parentId: input.parentId ?? null,
      level,
      isDetail,
      requiresContact: input.requiresContact ?? false,
      description: input.description ?? null,
      isContraAccount,
    };

    // 10. Crear la cuenta + cambiar isDetail del padre si es necesario (atómico)
    // D3 lock: port has no .transaction() — service calls prisma.$transaction directly.
    // tx arrives as Prisma.TransactionClient from $transaction; passes directly
    // to port (typed as `tx?: unknown`; adapter narrows internally per hex purity).
    if (parent && parent.isDetail) {
      return this.prisma.$transaction(async (tx) => {
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

    // Validar subtype: mismas reglas que create (matriz type↔subtype + mismatch con padre)
    if (input.subtype !== undefined) {
      if (account.level === 1) {
        throw new ValidationError(
          "Las cuentas raíz de nivel 1 no admiten subtipo",
        );
      }
      const parent = account.parentId
        ? await this.repo.findById(organizationId, account.parentId)
        : null;
      resolveAccountSubtype({
        inputSubtype: input.subtype,
        parentSubtype: parent?.subtype ?? null,
        resolvedType: account.type,
        level: account.level,
      });
    }

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
