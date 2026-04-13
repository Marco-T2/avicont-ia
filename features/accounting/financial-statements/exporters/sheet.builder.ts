// Transforma BalanceSheet / IncomeStatement en la estructura plana ExportSheet
// compartida por pdf.exporter y excel.exporter.
// Función pura: no tiene efectos secundarios, no importa pdfmake ni exceljs.

import { formatSubtypeLabel } from "@/features/accounting/account-subtype.utils";
import { roundHalfUp } from "../money.utils";
import type { ExportRow, ExportSheet } from "./statement-shape";
import type { BalanceSheet, IncomeStatement, SubtypeGroup } from "../financial-statements.types";

// ── Helpers ──

/** Formatea un Decimal como string con 2 decimales half-up. */
function fmt(d: { toFixed: (n: number) => string; toDecimalPlaces: (n: number, mode: number) => { toFixed: (n: number) => string } }): string {
  return roundHalfUp(d as Parameters<typeof roundHalfUp>[0]).toFixed(2);
}

/**
 * Convierte un SubtypeGroup en filas de tabla (header + cuentas + subtotal).
 */
function groupToRows(group: SubtypeGroup, indent: number): ExportRow[] {
  const rows: ExportRow[] = [];

  // Encabezado del subtipo
  rows.push({
    type: "header-subtype",
    label: formatSubtypeLabel(group.subtype),
    indent,
    bold: true,
  });

  // Cuentas del grupo
  for (const account of group.accounts) {
    rows.push({
      type: "account",
      label: account.name,
      code: account.code,
      balance: fmt(account.balance),
      indent: indent + 1,
      bold: false,
    });
  }

  // Subtotal del grupo
  rows.push({
    type: "subtotal",
    label: `Total ${formatSubtypeLabel(group.subtype)}`,
    balance: fmt(group.total),
    indent: indent + 1,
    bold: true,
  });

  return rows;
}

// ── Balance General ──

/**
 * Construye el ExportSheet del Balance General (Estado de Situación Patrimonial).
 */
export function buildBalanceSheetExportSheet(bs: BalanceSheet, orgName: string): ExportSheet {
  const { current } = bs;
  const rows: ExportRow[] = [];

  // Sección ACTIVO
  rows.push({ type: "header-section", label: "ACTIVO", indent: 0, bold: true });
  for (const group of current.assets.groups) {
    rows.push(...groupToRows(group, 1));
  }
  rows.push({
    type: "total",
    label: "TOTAL ACTIVO",
    balance: fmt(current.assets.total),
    indent: 0,
    bold: true,
  });

  // Sección PASIVO
  rows.push({ type: "header-section", label: "PASIVO", indent: 0, bold: true });
  for (const group of current.liabilities.groups) {
    rows.push(...groupToRows(group, 1));
  }
  rows.push({
    type: "total",
    label: "TOTAL PASIVO",
    balance: fmt(current.liabilities.total),
    indent: 0,
    bold: true,
  });

  // Sección PATRIMONIO
  rows.push({ type: "header-section", label: "PATRIMONIO", indent: 0, bold: true });
  for (const group of current.equity.groups) {
    rows.push(...groupToRows(group, 1));
  }
  rows.push({
    type: "total",
    label: "TOTAL PATRIMONIO",
    balance: fmt(current.equity.total),
    indent: 0,
    bold: true,
  });

  // Total general: PASIVO + PATRIMONIO
  const totalPasivoPatrimonio = current.liabilities.total.plus(current.equity.total);
  rows.push({
    type: "total",
    label: "TOTAL PASIVO + PATRIMONIO",
    balance: fmt(totalPasivoPatrimonio),
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
    });
  }

  const dateLabel = current.asOfDate.toLocaleDateString("es-BO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return {
    title: "Balance General",
    subtitle: `Al ${dateLabel}`,
    dateLabel: `Al ${dateLabel}`,
    orgName,
    rows,
    preliminary: current.preliminary,
    imbalanced: current.imbalanced,
    imbalanceDelta: current.imbalanced ? fmt(current.imbalanceDelta) : undefined,
  };
}

// ── Estado de Resultados ──

/**
 * Construye el ExportSheet del Estado de Resultados.
 */
export function buildIncomeStatementExportSheet(
  is: IncomeStatement,
  orgName: string,
): ExportSheet {
  const { current } = is;
  const rows: ExportRow[] = [];

  // Sección INGRESOS
  rows.push({ type: "header-section", label: "INGRESOS", indent: 0, bold: true });
  for (const group of current.income.groups) {
    rows.push(...groupToRows(group, 1));
  }
  rows.push({
    type: "total",
    label: "TOTAL INGRESOS",
    balance: fmt(current.income.total),
    indent: 0,
    bold: true,
  });

  // Utilidad Operativa (subtotal intermedio — REQ-5)
  rows.push({
    type: "subtotal",
    label: "Utilidad Operativa",
    balance: fmt(current.operatingIncome),
    indent: 0,
    bold: true,
  });

  // Sección GASTOS
  rows.push({ type: "header-section", label: "GASTOS", indent: 0, bold: true });
  for (const group of current.expenses.groups) {
    rows.push(...groupToRows(group, 1));
  }
  rows.push({
    type: "total",
    label: "TOTAL GASTOS",
    balance: fmt(current.expenses.total),
    indent: 0,
    bold: true,
  });

  // Utilidad Neta
  rows.push({
    type: "total",
    label: current.netIncome.isNegative() ? "PÉRDIDA NETA" : "UTILIDAD NETA",
    balance: fmt(current.netIncome),
    indent: 0,
    bold: true,
  });

  const fromLabel = current.dateFrom.toLocaleDateString("es-BO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const toLabel = current.dateTo.toLocaleDateString("es-BO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const dateLabel = `Del ${fromLabel} al ${toLabel}`;

  return {
    title: "Estado de Resultados",
    subtitle: dateLabel,
    dateLabel,
    orgName,
    rows,
    preliminary: current.preliminary,
    imbalanced: false,
  };
}
