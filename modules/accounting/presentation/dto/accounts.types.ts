/** Canonical hex DTO — account input/composite types (§13.X). */
import type { Account, AccountType, AccountNature, AccountSubtype } from "@/generated/prisma/client";

// ── Input types ──

export interface CreateAccountInput {
  code?: string;
  name: string;
  type?: AccountType;
  /** Sugerencia opcional del caller. Si se indica y conflictúa con la naturaleza derivada, se rechaza. */
  nature?: AccountNature;
  /** Subtipo de cuenta. Se hereda del padre si no se provee. Requerido para cuentas de nivel ≥ 2. */
  subtype?: AccountSubtype;
  parentId?: string;
  isDetail?: boolean;
  requiresContact?: boolean;
  description?: string;
  /**
   * Marca si esta cuenta es una cuenta reguladora (contra-cuenta).
   * Cuando isContraAccount=true, la naturaleza ESPERADA es la OPUESTA al tipo por defecto.
   * Ejemplo: ACTIVO + isContraAccount=true → nature=ACREEDORA (Depreciación Acumulada).
   * Default: false (comportamiento existente preservado).
   */
  isContraAccount?: boolean;
}

/** Datos completamente resueltos tras la validación en el service. El repositorio los recibe sin ambigüedad. */
export interface ResolvedCreateAccountData {
  code: string;
  name: string;
  type: AccountType;
  nature: AccountNature;
  /** Subtipo resuelto. Null solo para cuentas raíz de nivel 1 (cuentas estructurales). */
  subtype: AccountSubtype | null;
  parentId: string | null;
  level: number;
  isDetail: boolean;
  requiresContact: boolean;
  description: string | null;
  /** Resolved contra-account flag. Always boolean (defaults to false). */
  isContraAccount: boolean;
}

export interface UpdateAccountInput {
  name?: string;
  isActive?: boolean;
  isDetail?: boolean;
  requiresContact?: boolean;
  description?: string;
  /** Subtipo de cuenta. Permite corregir el subtipo de una cuenta existente. */
  subtype?: AccountSubtype;
  /**
   * Forward compatibility field for isContraAccount on update.
   * TODO(v2): reject isContraAccount flip without simultaneous nature update.
   * In v1 this field is accepted by the repo but no guard is enforced here.
   */
  isContraAccount?: boolean;
}

// ── Composite types ──

export type AccountWithChildren = Account & {
  children: Account[];
};
