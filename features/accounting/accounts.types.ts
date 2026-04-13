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
}

export interface UpdateAccountInput {
  name?: string;
  isActive?: boolean;
  isDetail?: boolean;
  requiresContact?: boolean;
  description?: string;
  /** Subtipo de cuenta. Permite corregir el subtipo de una cuenta existente. */
  subtype?: AccountSubtype;
}

// ── Composite types ──

export type AccountWithChildren = Account & {
  children: Account[];
};
