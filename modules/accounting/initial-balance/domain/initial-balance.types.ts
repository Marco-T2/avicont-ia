import type { AccountSubtype } from "@/generated/prisma/client";
import type DecimalJs from "decimal.js";

/**
 * Alias canónico de Decimal — decimal.js direct (DEC-1).
 *
 * Previo a este fix el alias apuntaba a `Prisma.Decimal`, lo que provocaba un
 * bug visual en `/initial-balance`: `serializeStatement` (financial-statements)
 * detecta Decimal vía `instanceof` de decimal.js, así que las filas con
 * Prisma.Decimal no se serializaban a string y llegaban al cliente como `{}`
 * → `parseFloat` daba NaN → `formatBOB` retornaba "Bs. 0,00" por su guard.
 * Los subtotales sí se renderizaban OK porque pasan por `sumDecimals` que
 * parte de `new Decimal(0)` (decimal.js) — de ahí la asimetría 0,00 vs 3.459.
 */
export type Decimal = DecimalJs;

/**
 * A single row of the Initial Balance report: one account with its signed-net
 * amount aggregated from the POSTED Comprobante de Apertura (CA) voucher(s).
 *
 * Sign convention (same as equity-statement v2):
 *   DEUDORA   accounts (Activo):  amount = debit − credit
 *   ACREEDORA accounts (Pasivo/Patrimonio): amount = credit − debit
 */
export interface InitialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  subtype: AccountSubtype;
  amount: Decimal;
}

/**
 * A subtype-grouped block of rows within a section (e.g. all ACTIVO_CORRIENTE
 * rows). The subtotal is the sum of `amount` across all rows in the group.
 */
export interface InitialBalanceGroup {
  subtype: AccountSubtype;
  /** Human-readable es-BO label (e.g. "Activo Corriente"). */
  label: string;
  rows: InitialBalanceRow[];
  subtotal: Decimal;
}

/**
 * One of the two top-level sections of the report: ACTIVO (all DEUDORA account
 * types) or PASIVO_PATRIMONIO (all ACREEDORA account types).
 */
export interface InitialBalanceSection {
  key: "ACTIVO" | "PASIVO_PATRIMONIO";
  /** Human-readable es-BO label (e.g. "Activo" | "Pasivo y Patrimonio"). */
  label: string;
  groups: InitialBalanceGroup[];
  sectionTotal: Decimal;
}

/**
 * Organization header metadata used by the PDF/XLSX exporters for the legal
 * Bolivian opening-balance layout. `representanteLegal` is optional in the
 * current schema; repos return empty string when not configured.
 */
export interface InitialBalanceOrgHeader {
  razonSocial: string;
  nit: string;
  representanteLegal: string;
  direccion: string;
  ciudad: string;
}

/**
 * Complete Initial Balance statement — the value returned by the service layer
 * to the API/UI boundary (before serialization).
 */
export interface InitialBalanceStatement {
  orgId: string;
  org: InitialBalanceOrgHeader;
  /** `min(je.date)` of POSTED CA entries, i.e. the opening date. */
  dateAt: Date;
  /** Tuple order: [ACTIVO, PASIVO_PATRIMONIO]. */
  sections: [InitialBalanceSection, InitialBalanceSection];
  /** True when Σ ACTIVO ≠ Σ (PASIVO+PATRIMONIO). */
  imbalanced: boolean;
  /** Absolute difference in Bs. between the two sections. Zero when balanced. */
  imbalanceDelta: Decimal;
  /** True when `caCount > 1`. */
  multipleCA: boolean;
  caCount: number;
}

/**
 * Pure input for `buildInitialBalance` — no Prisma client, no I/O.
 */
export interface BuildInitialBalanceInput {
  orgId: string;
  org: InitialBalanceOrgHeader;
  dateAt: Date;
  rows: InitialBalanceRow[];
  caCount: number;
}

