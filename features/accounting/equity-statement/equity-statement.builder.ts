import { Prisma } from "@/generated/prisma/client";
import { sumDecimals, eq } from "@/features/accounting/financial-statements/money.utils";
import type {
  BuildEquityStatementInput,
  EquityStatement,
  EquityRow,
  EquityCell,
  EquityColumn,
  EquityColumnTotals,
  ColumnKey,
  RowKey,
  EquityAccountMetadata,
} from "./equity-statement.types";

/**
 * Column map ordered longest-prefix-first so "3.2.1" wins over "3.2".
 * Accounts without a match fall through to OTROS_PATRIMONIO.
 */
export const COLUMN_MAP: ReadonlyArray<readonly [prefix: string, column: ColumnKey]> = [
  ["3.2.1", "APORTES_CAPITALIZAR"],
  ["3.1",   "CAPITAL_SOCIAL"],
  ["3.2",   "AJUSTE_CAPITAL"],
  ["3.3",   "RESERVA_LEGAL"],
  ["3.4",   "RESULTADOS_ACUMULADOS"],
  ["3.5",   "RESULTADOS_ACUMULADOS"],
] as const;

/** Canonical render order for F-605 columns. */
export const COLUMNS_ORDER: readonly ColumnKey[] = [
  "CAPITAL_SOCIAL",
  "APORTES_CAPITALIZAR",
  "AJUSTE_CAPITAL",
  "RESERVA_LEGAL",
  "RESULTADOS_ACUMULADOS",
  "OTROS_PATRIMONIO",
] as const;

/** Display labels for UI / PDF / XLSX. */
export const COLUMN_LABELS: Record<ColumnKey, string> = {
  CAPITAL_SOCIAL:        "Capital Social",
  APORTES_CAPITALIZAR:   "Aportes p/ Capitalizar",
  AJUSTE_CAPITAL:        "Ajuste de Capital",
  RESERVA_LEGAL:         "Reserva Legal",
  RESULTADOS_ACUMULADOS: "Resultados Acumulados",
  OTROS_PATRIMONIO:      "Otros Patrimonio",
};

/** Maps an account code to its F-605 ColumnKey. Pure. */
export function mapAccountCodeToColumn(code: string): ColumnKey {
  for (const [prefix, col] of COLUMN_MAP) {
    if (code.startsWith(prefix)) return col;
  }
  return "OTROS_PATRIMONIO";
}

// ── Builder ───────────────────────────────────────────────────────────────────

function initColumnMap(): Record<ColumnKey, Prisma.Decimal> {
  const ZERO = new Prisma.Decimal(0);
  return {
    CAPITAL_SOCIAL:        ZERO,
    APORTES_CAPITALIZAR:   ZERO,
    AJUSTE_CAPITAL:        ZERO,
    RESERVA_LEGAL:         ZERO,
    RESULTADOS_ACUMULADOS: ZERO,
    OTROS_PATRIMONIO:      ZERO,
  };
}

function aggregateByColumn(
  balances: Map<string, Prisma.Decimal>,
  accounts: EquityAccountMetadata[],
): Record<ColumnKey, Prisma.Decimal> {
  const result = initColumnMap();
  for (const acc of accounts) {
    const bal = balances.get(acc.id);
    if (!bal || bal.isZero()) continue;
    const col = mapAccountCodeToColumn(acc.code);
    result[col] = result[col].plus(bal);
  }
  return result;
}

function buildRow(
  key: RowKey,
  label: string,
  byColumn: Record<ColumnKey, Prisma.Decimal>,
): EquityRow {
  const cells: EquityCell[] = COLUMNS_ORDER.map((col) => ({
    column: col,
    amount: byColumn[col],
  }));
  const total = sumDecimals(cells.map((c) => c.amount));
  return { key, label, cells, total };
}

/**
 * Builds the EquityStatement from pre-fetched data.
 * Pure function — no Prisma client, no I/O.
 *
 * v1 scope (scope-decision #855): exactly 3 rows, periodResult assigned entirely
 * to RESULTADOS_ACUMULADOS (no typed movement rows yet).
 */
export function buildEquityStatement(input: BuildEquityStatementInput): EquityStatement {
  const { initialBalances, finalBalances, accounts, periodResult, dateFrom, dateTo, preliminary } = input;
  const ZERO = new Prisma.Decimal(0);

  const initialByColumn = aggregateByColumn(initialBalances, accounts);
  const finalByColumn   = aggregateByColumn(finalBalances,   accounts);

  // Resultado del ejercicio goes entirely to RESULTADOS_ACUMULADOS (v1 — scope-decision #855)
  const resultByColumn: Record<ColumnKey, Prisma.Decimal> = {
    CAPITAL_SOCIAL:        ZERO,
    APORTES_CAPITALIZAR:   ZERO,
    AJUSTE_CAPITAL:        ZERO,
    RESERVA_LEGAL:         ZERO,
    RESULTADOS_ACUMULADOS: periodResult,
    OTROS_PATRIMONIO:      ZERO,
  };

  const rows: EquityRow[] = [
    buildRow("SALDO_INICIAL",       "Saldo al inicio del período",  initialByColumn),
    buildRow("RESULTADO_EJERCICIO", "Resultado del ejercicio",      resultByColumn),
    buildRow("SALDO_FINAL",         "Saldo al cierre del período",  finalByColumn),
  ];

  const columnTotals = finalByColumn as EquityColumnTotals;
  const grandTotal = sumDecimals(Object.values(columnTotals));

  // Intra-statement invariant: for each column, cierre ≈ inicial + resultado_col
  // (v1 has no typed movement deltas — periodResult is the only movement)
  let imbalanceDelta = ZERO;
  for (const col of COLUMNS_ORDER) {
    const expected = initialByColumn[col].plus(resultByColumn[col]);
    const actual   = finalByColumn[col];
    const d        = actual.minus(expected).abs();
    if (d.gt(imbalanceDelta)) imbalanceDelta = d;
  }
  const imbalanced = !eq(imbalanceDelta, ZERO);

  // OTROS_PATRIMONIO visible only if it has any non-zero value in any row
  const othersNonZero =
    !initialByColumn.OTROS_PATRIMONIO.isZero() ||
    !finalByColumn.OTROS_PATRIMONIO.isZero();

  const columns: EquityColumn[] = COLUMNS_ORDER.map((key) => ({
    key,
    label: COLUMN_LABELS[key],
    visible: key === "OTROS_PATRIMONIO" ? othersNonZero : true,
  }));

  return {
    orgId: "",  // injected by the service
    dateFrom,
    dateTo,
    columns,
    rows,
    columnTotals,
    grandTotal,
    periodResult,
    imbalanced,
    imbalanceDelta,
    preliminary,
  };
}
