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
};

/** Filtros de entrada para el servicio. */
export type TrialBalanceFilters = {
  dateFrom: Date;
  dateTo: Date;
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

export type SerializedTrialBalanceReport = {
  orgId: string;
  dateFrom: string; // ISO date string
  dateTo: string;   // ISO date string
  rows: SerializedTrialBalanceRow[];
  totals: SerializedTrialBalanceTotals;
  imbalanced: boolean;
  deltaSumas: string;
  deltaSaldos: string;
};
