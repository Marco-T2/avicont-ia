import type { Prisma } from "@/generated/prisma/client";
import type { AccountType } from "@/generated/prisma/enums";

// ── Alias local para Decimal ──
export type Decimal = Prisma.Decimal;

/**
 * Una fila visible en la Hoja de Trabajo (REQ-2).
 * Contiene exactamente 12 columnas numéricas en orden canónico.
 */
export type WorksheetRow = {
  accountId: string;
  code: string;
  name: string;
  isContraAccount: boolean;
  accountType: AccountType;
  /** true solo para la fila de carry-over (Ganancia/Pérdida del Ejercicio) */
  isCarryOver: boolean;

  // Columnas 1-2: Sumas del Mayor
  sumasDebe: Decimal;
  sumasHaber: Decimal;

  // Columnas 3-4: Saldos del Mayor
  saldoDeudor: Decimal;
  saldoAcreedor: Decimal;

  // Columnas 5-6: Ajustes (asientos CJ, isAdjustment=true)
  ajustesDebe: Decimal;
  ajustesHaber: Decimal;

  // Columnas 7-8: Saldos Ajustados
  saldoAjDeudor: Decimal;
  saldoAjAcreedor: Decimal;

  // Columnas 9-10: Estado de Resultados
  resultadosPerdidas: Decimal;
  resultadosGanancias: Decimal;

  // Columnas 11-12: Balance General
  bgActivo: Decimal;
  bgPasPat: Decimal;
};

/**
 * Subtotales de las 12 columnas (reutilizado para grupos y grand totals).
 */
export type WorksheetTotals = {
  sumasDebe: Decimal;
  sumasHaber: Decimal;
  saldoDeudor: Decimal;
  saldoAcreedor: Decimal;
  ajustesDebe: Decimal;
  ajustesHaber: Decimal;
  saldoAjDeudor: Decimal;
  saldoAjAcreedor: Decimal;
  resultadosPerdidas: Decimal;
  resultadosGanancias: Decimal;
  bgActivo: Decimal;
  bgPasPat: Decimal;
};

/**
 * Grupo de cuentas del mismo tipo, con subtotales (REQ-9).
 */
export type WorksheetGroup = {
  accountType: AccountType;
  rows: WorksheetRow[];
  subtotals: WorksheetTotals;
};

/**
 * Filtros de entrada para el servicio (REQ-10).
 */
export type WorksheetFilters = {
  dateFrom: Date;
  dateTo: Date;
  fiscalPeriodId?: string;
};

/**
 * Reporte completo de la Hoja de Trabajo 12 Columnas (REQ-1, REQ-2, REQ-7, REQ-9, REQ-15).
 */
export type WorksheetReport = {
  orgId: string;
  dateFrom: Date;
  dateTo: Date;
  /** Grupos en orden canónico: ACTIVO → PASIVO → PATRIMONIO → INGRESO → GASTO */
  groups: WorksheetGroup[];
  /** Fila de carry-over Ganancia/Pérdida del Ejercicio (REQ-7). Undefined si resultado=0. */
  carryOverRow: WorksheetRow | undefined;
  grandTotals: WorksheetTotals;
  /** true si Σ(bgActivo) ≠ Σ(bgPasPat) tras el carry-over */
  imbalanced: boolean;
  imbalanceDelta: Decimal;
};
