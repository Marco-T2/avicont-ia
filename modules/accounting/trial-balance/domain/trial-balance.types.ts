import type { Prisma } from "@/generated/prisma/client";

// ── Alias local para Decimal ──
export type Decimal = Prisma.Decimal;

/**
 * Una fila visible en el Balance de Sumas y Saldos (REQ-2).
 * rowNumber NO está en el tipo de dominio — se asigna en tiempo de render (idx + 1).
 */
export type TrialBalanceRow = {
  accountId: string;
  code: string;
  name: string;

  // Columnas 1-2: Sumas del Mayor (todos los comprobantes, sin filtro isAdjustment)
  sumasDebe: Decimal;
  sumasHaber: Decimal;

  // Columnas 3-4: Saldos del Mayor (MAX(debe−haber, 0) y MAX(haber−debe, 0))
  saldoDeudor: Decimal;   // MAX(sumasDebe − sumasHaber, 0)
  saldoAcreedor: Decimal; // MAX(sumasHaber − sumasDebe, 0)
};

/** Totales de las 4 columnas numéricas del reporte. */
export type TrialBalanceTotals = {
  sumasDebe: Decimal;
  sumasHaber: Decimal;
  saldoDeudor: Decimal;
  saldoAcreedor: Decimal;
};

/**
 * Cuenta cuyo saldo final aterrizó en el lado OPUESTO a su naturaleza contable:
 *  - nature DEUDORA  con saldoAcreedor > 0 → anomalía
 *  - nature ACREEDORA con saldoDeudor   > 0 → anomalía
 *
 * Es una señal de calidad para el contador (anticipos no reclasificados,
 * errores de carga). Los totales del TB siguen cuadrando por partida doble
 * — la lista no corrige el balance, solo apunta a las filas a revisar.
 */
export type TrialBalanceOppositeSignAccount = {
  code: string;
  name: string;
  nature: "DEUDORA" | "ACREEDORA";
  saldoDeudor: Decimal;
  saldoAcreedor: Decimal;
};

/** Reporte completo del Balance de Comprobación de Sumas y Saldos. */
export type TrialBalanceReport = {
  orgId: string;
  dateFrom: Date;
  dateTo: Date;
  /** Filas ordenadas por account.code ASC */
  rows: TrialBalanceRow[];
  totals: TrialBalanceTotals;
  /** true si Σ sumasDebe ≠ Σ sumasHaber O Σ saldoDeudor ≠ Σ saldoAcreedor */
  imbalanced: boolean;
  /** Σ sumasDebe − Σ sumasHaber */
  deltaSumas: Decimal;
  /** Σ saldoDeudor − Σ saldoAcreedor */
  deltaSaldos: Decimal;
  /** Cuentas con saldo de naturaleza opuesta — señal de calidad, no afecta totales. */
  oppositeSignAccounts: TrialBalanceOppositeSignAccount[];
};

/** Filtros de entrada para el servicio. */
export type TrialBalanceFilters = {
  dateFrom: Date;
  dateTo: Date;
};

// ── Port-companion DTOs (surface contract of TrialBalanceQueryPort) ───────────

export type TrialBalanceMovement = {
  accountId: string;
  totalDebit: Decimal;
  totalCredit: Decimal;
};

export type TrialBalanceAccountMetadata = {
  id: string;
  code: string;
  name: string;
  isDetail: boolean;
  /** Naturaleza contable de la cuenta — usada para detectar anomalías por lado. */
  nature: "DEUDORA" | "ACREEDORA";
};

export type TrialBalanceOrgMetadata = {
  name: string;
  taxId: string | null;
  /** Dirección (calle/zona, sin ciudad) — null si no está configurada en OrgProfile. */
  address: string | null;
  /** Ciudad — null si no está configurada en OrgProfile. */
  city: string | null;
};

// ── Tipos serializados (frontera JSON) ────────────────────────────────────────
// Los Decimals se convierten a string con 2 decimales vía serializeStatement.

export type SerializedTrialBalanceRow = {
  accountId: string;
  code: string;
  name: string;
  sumasDebe: string;
  sumasHaber: string;
  saldoDeudor: string;
  saldoAcreedor: string;
};

export type SerializedTrialBalanceTotals = {
  sumasDebe: string;
  sumasHaber: string;
  saldoDeudor: string;
  saldoAcreedor: string;
};

export type SerializedTrialBalanceOppositeSignAccount = {
  code: string;
  name: string;
  nature: "DEUDORA" | "ACREEDORA";
  saldoDeudor: string;
  saldoAcreedor: string;
};

export type SerializedTrialBalanceReport = {
  orgId: string;
  dateFrom: string; // ISO date string
  dateTo: string;   // ISO date string
  rows: SerializedTrialBalanceRow[];
  totals: SerializedTrialBalanceTotals;
  imbalanced: boolean;
  deltaSumas: string;
  deltaSaldos: string;
  oppositeSignAccounts: SerializedTrialBalanceOppositeSignAccount[];
};
