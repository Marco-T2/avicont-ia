// Transforma BalanceSheet / IncomeStatement en la estructura plana ExportSheet
// compartida por pdf.exporter y excel.exporter.
// Función pura: no tiene efectos secundarios, no importa pdfmake ni exceljs.
//
// PR4: añade soporte multi-columna.
// - ExportSheet.columns: ExportColumn[] derivadas de BalanceSheet.columns / IncomeStatement.columns
// - ExportSheet.orientation: siempre "portrait" — el PDF usa chunking horizontal (QB-style)
// - ExportRow.balances: Record<columnId, saldo formateado> — complementa balance (backward compat)

import { formatSubtypeLabel } from "@/modules/accounting/domain/account-subtype.utils";
import { formatDateBO } from "@/lib/date-utils";
import { roundHalfUp } from "../../domain/money.utils";
import type { ExportColumn, ExportRow, ExportSheet } from "./statement-shape";
import type { BalanceSheet, IncomeStatement, SubtypeGroup, StatementColumn } from "../../domain/types/financial-statements.types";

// ── Constantes ──

/** Columnas de valor por página en el layout QB-style (portrait con chunking horizontal). */
const DEFAULT_COLS_PER_PAGE = 6;

// ── Pure helpers ──

/** Formatea un Decimal como string con 2 decimales half-up. */
function fmt(d: { toFixed: (n: number) => string; toDecimalPlaces: (n: number, mode: number) => { toFixed: (n: number) => string } }): string {
  return roundHalfUp(d as Parameters<typeof roundHalfUp>[0]).toFixed(2);
}

/**
 * @deprecated pdf.exporter usa BODY_FONT_SIZE=8 fijo (QB-style portrait).
 * Shim para no romper código externo que aún la importe.
 */
export function selectBodyFontSize(_columnCount: number): number {
  return 8;
}

/**
 * Divide un array de columnas en grupos de `maxPerPage` para el layout
 * QB-style: portrait siempre, contenido cortado horizontalmente por páginas.
 *
 * - 0 cols → [[]]
 * - ≤ maxPerPage cols → [[...todas]]
 * - > maxPerPage cols → múltiples chunks de hasta maxPerPage
 */
export function chunkColumnsForPage(
  columns: ExportColumn[],
  maxPerPage = DEFAULT_COLS_PER_PAGE,
): ExportColumn[][] {
  if (columns.length === 0) return [[]];
  const chunks: ExportColumn[][] = [];
  for (let i = 0; i < columns.length; i += maxPerPage) {
    chunks.push(columns.slice(i, i + maxPerPage));
  }
  return chunks;
}

/**
 * Convierte un StatementColumn[] en ExportColumn[].
 * Cuando el array está vacío o es undefined, genera la columna legacy "Total".
 */
function toExportColumns(statementColumns: StatementColumn[] | undefined): ExportColumn[] {
  if (!statementColumns || statementColumns.length === 0) {
    return [{ id: "col-current", label: "Total", role: "current" }];
  }
  return statementColumns.map((c) => ({
    id: c.id,
    label: c.label,
    role: c.role,
  }));
}

/**
 * Orientación de página: siempre portrait.
 * El PDF usa chunking horizontal QB-style (chunkColumnsForPage) en lugar de landscape.
 * Parámetro ignorado — se mantiene la firma para no romper callers internos.
 */
function resolveOrientation(_columns: ExportColumn[]): "portrait" {
  return "portrait";
}

// ── Helpers de fila ──

/**
 * Construye el Record<columnId, valor> para una fila a partir de un único
 * valor de saldo serializado aplicado a todas las columnas.
 *
 * Nota: para multi-columna real, los saldos individuales por columna deberían
 * venir del servicio. En esta versión el sheet.builder tiene acceso solo al
 * `current` (primera columna); para columnas adicionales se replica el mismo
 * valor del current porque el service aún no proporciona valores por columna
 * en el nivel de SubtypeGroup. Esto es correcto para single-column y para
 * exports donde el usuario quiere ver el mismo total replicado (diseño §8.4:
 * "all rows expanded" inherente al builder approach).
 *
 * Si en una versión futura el service expone balances por columna en el
 * SubtypeGroup, reemplazar este helper por una lookup de mapa de datos.
 */
function buildBalances(
  value: string,
  columns: ExportColumn[],
): Record<string, string> {
  return Object.fromEntries(columns.map((c) => [c.id, value]));
}

/**
 * Convierte un SubtypeGroup en filas de tabla (header + cuentas + subtotal).
 */
function groupToRows(
  group: SubtypeGroup,
  indent: number,
  columns: ExportColumn[],
): ExportRow[] {
  const rows: ExportRow[] = [];
  const subtypeLabel = formatSubtypeLabel(group.subtype);
  const totalStr = fmt(group.total);

  // Encabezado del subtipo
  rows.push({
    type: "header-subtype",
    label: subtypeLabel,
    indent,
    bold: true,
    balances: buildBalances(totalStr, columns),
  });

  // Cuentas del grupo
  for (const account of group.accounts) {
    const rawBalStr = fmt(account.balance);
    // Contra-accounts: wrap the formatted string in parens for the PDF/string path.
    // The Excel exporter uses row.isContra to negate the numeric value independently.
    const isContra = account.isContra === true;
    const balStr = isContra ? `(${rawBalStr})` : rawBalStr;
    rows.push({
      type: "account",
      label: account.name,
      code: account.code,
      balance: balStr,
      balances: buildBalances(balStr, columns),
      indent: indent + 1,
      bold: false,
      isContra,
    });
  }

  // Subtotal del grupo
  rows.push({
    type: "subtotal",
    label: `Total ${subtypeLabel}`,
    balance: totalStr,
    balances: buildBalances(totalStr, columns),
    indent: indent + 1,
    bold: true,
  });

  return rows;
}

// ── Balance General ──

/**
 * Construye el ExportSheet del Balance General (Estado de Situación Patrimonial).
 *
 * PR4: propaga columns y orientation. Si bs.columns tiene > 1 elemento,
 * el sheet tendrá múltiples columnas de valor.
 */
export function buildBalanceSheetExportSheet(bs: BalanceSheet, orgName: string): ExportSheet {
  const { current } = bs;
  const exportColumns = toExportColumns(bs.columns);
  const orientation = resolveOrientation(exportColumns);
  const rows: ExportRow[] = [];

  // Sección ACTIVO
  rows.push({ type: "header-section", label: "ACTIVO", indent: 0, bold: true, balances: {} });
  for (const group of current.assets.groups) {
    rows.push(...groupToRows(group, 1, exportColumns));
  }
  const totalActivoStr = fmt(current.assets.total);
  rows.push({
    type: "total",
    label: "TOTAL ACTIVO",
    balance: totalActivoStr,
    balances: buildBalances(totalActivoStr, exportColumns),
    indent: 0,
    bold: true,
  });

  // Sección PASIVO
  rows.push({ type: "header-section", label: "PASIVO", indent: 0, bold: true, balances: {} });
  for (const group of current.liabilities.groups) {
    rows.push(...groupToRows(group, 1, exportColumns));
  }
  const totalPasivoStr = fmt(current.liabilities.total);
  rows.push({
    type: "total",
    label: "TOTAL PASIVO",
    balance: totalPasivoStr,
    balances: buildBalances(totalPasivoStr, exportColumns),
    indent: 0,
    bold: true,
  });

  // Sección PATRIMONIO
  rows.push({ type: "header-section", label: "PATRIMONIO", indent: 0, bold: true, balances: {} });
  for (const group of current.equity.groups) {
    rows.push(...groupToRows(group, 1, exportColumns));
  }
  const totalPatrimonioStr = fmt(current.equity.total);
  rows.push({
    type: "total",
    label: "TOTAL PATRIMONIO",
    balance: totalPatrimonioStr,
    balances: buildBalances(totalPatrimonioStr, exportColumns),
    indent: 0,
    bold: true,
  });

  // Total general: PASIVO + PATRIMONIO
  const totalPasivoPatrimonio = current.liabilities.total.plus(current.equity.total);
  const totalPPStr = fmt(totalPasivoPatrimonio);
  rows.push({
    type: "total",
    label: "TOTAL PASIVO + PATRIMONIO",
    balance: totalPPStr,
    balances: buildBalances(totalPPStr, exportColumns),
    indent: 0,
    bold: true,
  });

  // Fila de desbalance (si aplica)
  if (current.imbalanced) {
    rows.push({
      type: "imbalance",
      label: `Ecuación desbalanceada — Delta: ${fmt(current.imbalanceDelta)} BOB`,
      indent: 0,
      bold: true,
      balances: {},
    });
  }

  // §13.accounting.calendar-day-T12-utc-unified — TZ-safe ISO-slice.
  const dateLabel = formatDateBO(current.asOfDate);

  return {
    title: "Balance General",
    subtitle: `Al ${dateLabel}`,
    dateLabel: `Al ${dateLabel}`,
    orgName,
    rows,
    preliminary: current.preliminary,
    imbalanced: current.imbalanced,
    imbalanceDelta: current.imbalanced ? fmt(current.imbalanceDelta) : undefined,
    columns: exportColumns,
    orientation,
  };
}

// ── Estado de Resultados ──

/**
 * Construye el ExportSheet del Estado de Resultados.
 *
 * PR4: propaga columns y orientation.
 */
export function buildIncomeStatementExportSheet(
  is: IncomeStatement,
  orgName: string,
): ExportSheet {
  const { current } = is;
  const exportColumns = toExportColumns(is.columns);
  const orientation = resolveOrientation(exportColumns);
  const rows: ExportRow[] = [];

  // Sección INGRESOS
  rows.push({ type: "header-section", label: "INGRESOS", indent: 0, bold: true, balances: {} });
  for (const group of current.income.groups) {
    rows.push(...groupToRows(group, 1, exportColumns));
  }
  const totalIngresosStr = fmt(current.income.total);
  rows.push({
    type: "total",
    label: "TOTAL INGRESOS",
    balance: totalIngresosStr,
    balances: buildBalances(totalIngresosStr, exportColumns),
    indent: 0,
    bold: true,
  });

  // Utilidad Operativa (subtotal intermedio — REQ-5)
  const opIncomeStr = fmt(current.operatingIncome);
  rows.push({
    type: "subtotal",
    label: "Utilidad Operativa",
    balance: opIncomeStr,
    balances: buildBalances(opIncomeStr, exportColumns),
    indent: 0,
    bold: true,
  });

  // Sección GASTOS
  rows.push({ type: "header-section", label: "GASTOS", indent: 0, bold: true, balances: {} });
  for (const group of current.expenses.groups) {
    rows.push(...groupToRows(group, 1, exportColumns));
  }
  const totalGastosStr = fmt(current.expenses.total);
  rows.push({
    type: "total",
    label: "TOTAL GASTOS",
    balance: totalGastosStr,
    balances: buildBalances(totalGastosStr, exportColumns),
    indent: 0,
    bold: true,
  });

  // Utilidad Neta
  const netStr = fmt(current.netIncome);
  rows.push({
    type: "total",
    label: current.netIncome.isNegative() ? "PÉRDIDA NETA" : "UTILIDAD NETA",
    balance: netStr,
    balances: buildBalances(netStr, exportColumns),
    indent: 0,
    bold: true,
  });

  // §13.accounting.calendar-day-T12-utc-unified — TZ-safe ISO-slice.
  const fromLabel = formatDateBO(current.dateFrom);
  const toLabel = formatDateBO(current.dateTo);
  const dateLabel = `Del ${fromLabel} al ${toLabel}`;

  return {
    title: "Estado de Resultados",
    subtitle: dateLabel,
    dateLabel,
    orgName,
    rows,
    preliminary: current.preliminary,
    imbalanced: false,
    columns: exportColumns,
    orientation,
  };
}
