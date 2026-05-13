// R1-permissible-value-type-exception: runtime-imports Prisma.Decimal (value-type
// arithmetic engine, not entity). Cite ES design #2302 §5. [[textual_rule_verification]]
// verified at C0 GREEN: modules/shared/domain/value-objects/money.ts:4-10.
//
// REQ-009 LOCKED (D4 Option A): ZERO imports from @/modules/accounting/financial-statements/**.
// sumDecimals + eq sourced from ./money.utils (own domain copy) — NOT from FS presentation barrel.
import { Prisma } from "@/generated/prisma/client";
import { sumDecimals, eq } from "./money.utils";
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
  PatrimonyVoucherCode,
} from "./equity-statement.types";

/**
 * Config per voucher code → row key, display label and canonical order.
 * `order` fija la secuencia entre SALDO_INICIAL y RESULTADO_EJERCICIO.
 */
const TYPED_ROW_CONFIG: Record<
  PatrimonyVoucherCode,
  { key: RowKey; label: string; order: number }
> = {
  CP: { key: "APORTE_CAPITAL",         label: "Aportes de capital del período", order: 1 },
  CL: { key: "CONSTITUCION_RESERVA",   label: "Constitución de reservas",       order: 2 },
  CV: { key: "DISTRIBUCION_DIVIDENDO", label: "Distribuciones a socios",        order: 3 },
};

/**
 * Column map ordered longest-prefix-first so "3.2.1" wins over "3.2".
 * Accounts without a match fall through to OTROS_PATRIMONIO.
 */
const COLUMN_MAP: ReadonlyArray<readonly [prefix: string, column: ColumnKey]> = [
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
 * v2 scope: emits typed patrimony rows (APORTE_CAPITAL, CONSTITUCION_RESERVA,
 * DISTRIBUCION_DIVIDENDO) conditionally from `typedMovements`. Each typed row
 * appears only if at least one column has a non-zero net delta. Invariant:
 *   SALDO_FINAL[col] ≈ SALDO_INICIAL[col] + Σ typed rows[col] + RESULTADO_EJERCICIO[col]
 */
export function buildEquityStatement(input: BuildEquityStatementInput): EquityStatement {
  const {
    initialBalances,
    finalBalances,
    accounts,
    typedMovements,
    aperturaBaseline,
    periodResult,
    dateFrom,
    dateTo,
    preliminary,
  } = input;
  const ZERO = new Prisma.Decimal(0);

  const initialByColumn = aggregateByColumn(initialBalances, accounts);
  const finalByColumn   = aggregateByColumn(finalBalances,   accounts);

  // account.id → ColumnKey lookup (reutiliza COLUMN_MAP vía mapAccountCodeToColumn)
  const accountColumn = new Map<string, ColumnKey>();
  for (const acc of accounts) {
    accountColumn.set(acc.id, mapAccountCodeToColumn(acc.code));
  }

  // Merge CA-voucher apertura deltas into initial column state BEFORE invariant check — CA is opening balance (state), not a period movement (would contaminate F-605 rows).
  if (aperturaBaseline && aperturaBaseline.size > 0) {
    for (const [accId, delta] of aperturaBaseline) {
      const col = accountColumn.get(accId);
      if (!col) continue; // cuenta fuera del set patrimonio — ignorar
      initialByColumn[col] = initialByColumn[col].plus(delta);
    }
  }

  // Typed rows: for each (code, accountMap), aggregate deltas by column and
  // emit a row iff at least one column is non-zero. Accumulate per-column total
  // for the invariant check.
  const typedCandidates: Array<{ order: number; row: EquityRow }> = [];
  const typedByColumnTotal = initColumnMap();
  let cvTouchesResultados = false;

  for (const [code, accountMap] of typedMovements) {
    const cfg = TYPED_ROW_CONFIG[code];
    if (!cfg) continue;

    const byColumn = initColumnMap();
    for (const [accId, delta] of accountMap) {
      const col = accountColumn.get(accId);
      if (!col) continue; // cuenta fuera del set patrimonio — ignorar
      byColumn[col] = byColumn[col].plus(delta);
      if (code === "CV" && col === "RESULTADOS_ACUMULADOS" && !delta.isZero()) {
        cvTouchesResultados = true;
      }
    }

    const hasMovement = COLUMNS_ORDER.some((c) => !byColumn[c].isZero());
    if (!hasMovement) continue;

    for (const c of COLUMNS_ORDER) {
      typedByColumnTotal[c] = typedByColumnTotal[c].plus(byColumn[c]);
    }
    typedCandidates.push({ order: cfg.order, row: buildRow(cfg.key, cfg.label, byColumn) });
  }
  const typedRows: EquityRow[] = typedCandidates
    .sort((a, b) => a.order - b.order)
    .map((c) => c.row);

  // Resultado del ejercicio goes entirely to RESULTADOS_ACUMULADOS
  const resultByColumn: Record<ColumnKey, Prisma.Decimal> = {
    CAPITAL_SOCIAL:        ZERO,
    APORTES_CAPITALIZAR:   ZERO,
    AJUSTE_CAPITAL:        ZERO,
    RESERVA_LEGAL:         ZERO,
    RESULTADOS_ACUMULADOS: periodResult,
    OTROS_PATRIMONIO:      ZERO,
  };

  // Preliminary projection (v1 behavior): si el período está abierto, la P&L
  // aún no cerró a 3.4, entonces proyectamos periodResult sobre el ledger para
  // que la identidad cierre. REQ-5: si hay una fila tipada CV tocando RA,
  // asumimos que el contador ya registró manualmente el cierre en esa CV, y
  // omitimos la proyección para evitar doble conteo.
  if (preliminary && !cvTouchesResultados) {
    finalByColumn.RESULTADOS_ACUMULADOS = finalByColumn.RESULTADOS_ACUMULADOS.plus(periodResult);
  }

  const rows: EquityRow[] = [
    buildRow("SALDO_INICIAL", "Saldo al inicio del período", initialByColumn),
    ...typedRows,
    buildRow("RESULTADO_EJERCICIO", "Resultado del ejercicio", resultByColumn),
    buildRow("SALDO_FINAL", "Saldo al cierre del período", finalByColumn),
  ];

  const columnTotals = finalByColumn as EquityColumnTotals;
  const grandTotal = sumDecimals(Object.values(columnTotals));

  // Intra-statement invariant con filas tipadas (REQ-3):
  //   final[col] ≈ initial[col] + typed_total[col] + resultado[col]
  let imbalanceDelta = ZERO;
  for (const col of COLUMNS_ORDER) {
    const expected = initialByColumn[col]
      .plus(typedByColumnTotal[col])
      .plus(resultByColumn[col]);
    const actual = finalByColumn[col];
    const d      = actual.minus(expected).abs();
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
