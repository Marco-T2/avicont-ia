/**
 * Accounting primitive types — domain layer (hexagonal R1 boundary).
 *
 * `AccountNature` and `AccountType` are string-literal unions that mirror the
 * Prisma enum values used across the accounting bounded context. Defined here
 * so domain ports can reference them without importing from application or
 * infrastructure layers (R1 hex rule).
 *
 * Application builders (`cc-line.builder`, `ca-line.builder`) and
 * infrastructure adapters re-export or import from this file — the domain is
 * the canonical source.
 */

/** Accounting nature of an account (`"DEUDORA"` = debit-normal, `"ACREEDORA"` = credit-normal). */
export type AccountNature = "DEUDORA" | "ACREEDORA";

/** Classification of an account within the chart of accounts. */
export type AccountType =
  | "ACTIVO"
  | "PASIVO"
  | "PATRIMONIO"
  | "INGRESO"
  | "GASTO";
