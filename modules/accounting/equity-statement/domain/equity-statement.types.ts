import type { Prisma } from "@/generated/prisma/client";

export type Decimal = Prisma.Decimal;

/** Columnas F-605 Bolivia (fijas, siempre presentes en el orden) + fallback "Otros". */
export type ColumnKey =
  | "CAPITAL_SOCIAL"
  | "APORTES_CAPITALIZAR"
  | "AJUSTE_CAPITAL"
  | "RESERVA_LEGAL"
  | "RESULTADOS_ACUMULADOS"
  | "OTROS_PATRIMONIO";

/**
 * Filas del EEPN. Las tres tipadas (APORTE_CAPITAL, CONSTITUCION_RESERVA,
 * DISTRIBUCION_DIVIDENDO) se emiten sólo si hay movimiento ≠ 0 en el período.
 * El orden canónico lo fija el builder, no este tipo.
 */
export type RowKey =
  | "SALDO_INICIAL"
  | "APORTE_CAPITAL"
  | "CONSTITUCION_RESERVA"
  | "DISTRIBUCION_DIVIDENDO"
  | "RESULTADO_EJERCICIO"
  | "SALDO_FINAL";

/** Códigos de VoucherTypeCfg que clasifican movimientos directos al patrimonio. */
export type PatrimonyVoucherCode = "CP" | "CL" | "CV";

/**
 * Movimientos tipados del período: agrupa JournalLines POSTED por
 * (voucherType.code, account.id) → delta Decimal (credit − debit si nature=ACREEDORA).
 */
export type TypedPatrimonyMovements = Map<
  PatrimonyVoucherCode,
  Map<string /* accountId */, Decimal>
>;

/** Celda de una fila — un valor Decimal por columna F-605. */
export type EquityCell = {
  column: ColumnKey;
  amount: Decimal;
};

/** Una fila del EEPN: etiqueta + celdas por columna + total horizontal. */
export type EquityRow = {
  key: RowKey;
  label: string;
  cells: EquityCell[];
  total: Decimal;
};

/** Metadata de una columna — usada por el render para construir el header. */
export type EquityColumn = {
  key: ColumnKey;
  label: string;
  visible: boolean;
};

/** Totales por columna al cierre (equivalentes a SALDO_FINAL.cells pero expuestos por claridad). */
export type EquityColumnTotals = {
  [K in ColumnKey]: Decimal;
};

/** Reporte completo del EEPN. */
export type EquityStatement = {
  orgId: string;
  dateFrom: Date;
  dateTo: Date;
  columns: EquityColumn[];
  rows: EquityRow[];
  columnTotals: EquityColumnTotals;
  grandTotal: Decimal;
  periodResult: Decimal;
  imbalanced: boolean;
  imbalanceDelta: Decimal;
  preliminary: boolean;
};

/** Inputs del builder — PURE, sin Prisma client. */
export type BuildEquityStatementInput = {
  initialBalances: Map<string, Decimal>;
  finalBalances: Map<string, Decimal>;
  accounts: EquityAccountMetadata[];
  /** Mapa de movimientos tipados del período (puede ser Map vacío). */
  typedMovements: TypedPatrimonyMovements;
  /**
   * Delta neto firmado por accountId (PATRIMONIO) derivado de JournalLines de CA
   * dentro de `[dateFrom, dateTo]`. Se fusiona en `initialByColumn` antes del invariant check.
   */
  aperturaBaseline?: Map<string, Decimal>;
  periodResult: Decimal;
  dateFrom: Date;
  dateTo: Date;
  preliminary: boolean;
};

/** Metadata de cuenta de patrimonio que consume el builder. */
export type EquityAccountMetadata = {
  id: string;
  code: string;
  name: string;
  nature: "DEUDORA" | "ACREEDORA";
};

// ── Tipos serializados (frontera JSON) ─────────────────────────────────────────

export type SerializedEquityCell = { column: ColumnKey; amount: string };

export type SerializedEquityRow = {
  key: RowKey;
  label: string;
  cells: SerializedEquityCell[];
  total: string;
};

export type SerializedEquityStatement = {
  orgId: string;
  dateFrom: string;
  dateTo: string;
  columns: EquityColumn[];
  rows: SerializedEquityRow[];
  columnTotals: Record<ColumnKey, string>;
  grandTotal: string;
  periodResult: string;
  imbalanced: boolean;
  imbalanceDelta: string;
  preliminary: boolean;
};
