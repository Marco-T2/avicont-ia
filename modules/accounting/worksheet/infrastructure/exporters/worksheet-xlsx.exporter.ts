/**
 * XLSX exporter for Hoja de Trabajo 12 Columnas.
 *
 * Design §6: wide-table format with 14 columns (Código + Cuenta + 12 numeric),
 * two header rows (merged pair labels + Debe/Haber sub-labels), frozen pane
 * at xSplit=2 / ySplit=7.
 *
 * Zero-value convention (Option A — Bolivian accounting, confirmed 2026-04-20):
 *   - Detail rows: zero → empty string "" (no activity noise)
 *   - Subtotal / grand-total rows: zero → numeric 0 (renders as "0.00" via numFmt)
 *
 * Contra-accounts: write negative number in bgActivo column.
 * numFmt "#,##0.00;(#,##0.00)" renders negatives with parens natively.
 *
 * This module is self-contained; does NOT import from excel.exporter.ts to
 * keep exporter modules decoupled (design decision).
 */

import ExcelJS from "exceljs";
import { formatDateBO } from "@/lib/date-utils";
import type { WorksheetReport, WorksheetTotals, WorksheetRow } from "../../domain/worksheet.types";

// ── Constants ─────────────────────────────────────────────────────────────────

const NUMBER_FORMAT = "#,##0.00;(#,##0.00)";

const STYLE = {
  text: "000000",
  textMuted: "6B7280",
  border: "000000",
  preliminary: "B45309",
} as const;

// Column index helpers (1-based for ExcelJS)
const COL_CODIGO = 1;   // A
const COL_CUENTA = 2;   // B
const COL_FIRST_NUM = 3; // C — sumasDebe
// C=3 sumasDebe, D=4 sumasHaber, E=5 saldoDeudor, F=6 saldoAcreedor
// G=7 ajustesDebe, H=8 ajustesHaber, I=9 saldoAjDeudor, J=10 saldoAjAcreedor
// K=11 resultadosPerdidas, L=12 resultadosGanancias, M=13 bgActivo, N=14 bgPasPat
const COL_LAST = 14; // N

// ── Font helpers ──────────────────────────────────────────────────────────────

function arial(opts: {
  bold?: boolean;
  size?: number;
  italic?: boolean;
  color?: string;
}): Partial<ExcelJS.Font> {
  return {
    name: "Arial",
    bold: opts.bold ?? false,
    italic: opts.italic ?? false,
    size: opts.size ?? 8,
    color: { argb: opts.color ?? STYLE.text },
  };
}

// ── Numeric cell writer ───────────────────────────────────────────────────────

/**
 * Writes a Prisma.Decimal value as a native ExcelJS number cell.
 *
 * Option A zero-value rule:
 *   - isTotal=false (detail row): zero → write empty string ""
 *   - isTotal=true  (subtotal / grand total): zero → write numeric 0
 *
 * Contra rule: the value is already sign-flipped by the builder (bgActivo is
 * a negative Decimal for contra accounts). We just call .toNumber() — no extra
 * negation needed here.
 */
function writeDecimalCell(
  cell: ExcelJS.Cell,
  decimal: { isZero(): boolean; toNumber(): number },
  opts: { bold?: boolean; size?: number; isTotal?: boolean },
): void {
  if (decimal.isZero() && !opts.isTotal) {
    cell.value = "";
  } else {
    cell.value = decimal.toNumber();
    cell.numFmt = NUMBER_FORMAT;
  }
  cell.font = arial({ bold: opts.bold, size: opts.size ?? 8 });
  cell.alignment = { horizontal: "right" };
}

// ── Border helpers ────────────────────────────────────────────────────────────

function thinTop(): Partial<ExcelJS.Borders> {
  return { top: { style: "thin", color: { argb: STYLE.border } } };
}

function thinTopBottom(): Partial<ExcelJS.Borders> {
  return {
    top: { style: "thin", color: { argb: STYLE.border } },
    bottom: { style: "thin", color: { argb: STYLE.border } },
  };
}

// ── Decimal field extraction in canonical column order ────────────────────────

/**
 * Returns the 12 Decimal values of a WorksheetRow or WorksheetTotals
 * in canonical column order C..N.
 */
function get12Cols(row: WorksheetRow | WorksheetTotals): Array<{ isZero(): boolean; toNumber(): number }> {
  return [
    row.sumasDebe,
    row.sumasHaber,
    row.saldoDeudor,
    row.saldoAcreedor,
    row.ajustesDebe,
    row.ajustesHaber,
    row.saldoAjDeudor,
    row.saldoAjAcreedor,
    row.resultadosPerdidas,
    row.resultadosGanancias,
    row.bgActivo,
    row.bgPasPat,
  ];
}

// ── Row writers ───────────────────────────────────────────────────────────────

/** Writes the 12 numeric columns (C..N) for a detail row (Option A: zero → ""). */
function writeDetailNumericCols(
  excelRow: ExcelJS.Row,
  row: WorksheetRow | WorksheetTotals,
  opts: { bold?: boolean; size?: number; isTotal?: boolean },
): void {
  const cols = get12Cols(row);
  cols.forEach((dec, i) => {
    const colIdx = COL_FIRST_NUM + i; // C=3 .. N=14
    writeDecimalCell(excelRow.getCell(colIdx), dec, opts);
  });
}

/** Writes a group header row (ACTIVO, PASIVO, etc.) spanning B..N. */
function writeGroupHeaderRow(
  sheet: ExcelJS.Worksheet,
  rowNum: number,
  label: string,
): void {
  const excelRow = sheet.getRow(rowNum);
  const cell = excelRow.getCell(COL_CUENTA);
  cell.value = label;
  cell.font = arial({ bold: true, size: 8 });
  cell.alignment = { horizontal: "left" };
}

/** Writes a detail account row. */
function writeAccountRow(
  sheet: ExcelJS.Worksheet,
  rowNum: number,
  row: WorksheetRow,
): void {
  const excelRow = sheet.getRow(rowNum);
  excelRow.getCell(COL_CODIGO).value = row.code;
  excelRow.getCell(COL_CODIGO).font = arial({ size: 8 });
  excelRow.getCell(COL_CUENTA).value = row.name;
  excelRow.getCell(COL_CUENTA).font = arial({ size: 8, italic: row.isCarryOver });
  excelRow.getCell(COL_CUENTA).alignment = { horizontal: "left" };
  writeDetailNumericCols(excelRow, row, { bold: row.isCarryOver, isTotal: false });
}

/** Writes a subtotal row (per AccountType group). */
function writeSubtotalRow(
  sheet: ExcelJS.Worksheet,
  rowNum: number,
  label: string,
  totals: WorksheetTotals,
): void {
  const excelRow = sheet.getRow(rowNum);
  const labelCell = excelRow.getCell(COL_CUENTA);
  labelCell.value = label;
  labelCell.font = arial({ bold: true, size: 8 });
  labelCell.alignment = { horizontal: "left" };
  labelCell.border = thinTop();

  writeDetailNumericCols(excelRow, totals, { bold: true, isTotal: true });
  // Apply top border to numeric cells too
  for (let c = COL_FIRST_NUM; c <= COL_LAST; c++) {
    excelRow.getCell(c).border = thinTop();
  }
}

/** Writes the grand totals row. */
function writeGrandTotalRow(
  sheet: ExcelJS.Worksheet,
  rowNum: number,
  totals: WorksheetTotals,
): void {
  const excelRow = sheet.getRow(rowNum);
  const labelCell = excelRow.getCell(COL_CUENTA);
  labelCell.value = "TOTALES";
  labelCell.font = arial({ bold: true, size: 9 });
  labelCell.alignment = { horizontal: "left" };
  labelCell.border = thinTopBottom();

  writeDetailNumericCols(excelRow, totals, { bold: true, size: 9, isTotal: true });
  for (let c = COL_FIRST_NUM; c <= COL_LAST; c++) {
    excelRow.getCell(c).border = thinTopBottom();
  }
}

// ── Document header (rows 1-7) ────────────────────────────────────────────────

function writeDocumentHeader(
  sheet: ExcelJS.Worksheet,
  report: WorksheetReport,
  orgName: string,
  lastCol: string,
): void {
  // Row 1: title
  sheet.getRow(1).getCell(1).value = "Hoja de Trabajo";
  sheet.getRow(1).getCell(1).font = arial({ bold: true, size: 14 });
  sheet.getRow(1).getCell(1).alignment = { horizontal: "center" };
  sheet.mergeCells(`A1:${lastCol}1`);

  // Row 2: org name
  sheet.getRow(2).getCell(1).value = orgName;
  sheet.getRow(2).getCell(1).font = arial({ bold: true, size: 12 });
  sheet.getRow(2).getCell(1).alignment = { horizontal: "center" };
  sheet.mergeCells(`A2:${lastCol}2`);

  // Row 3: period
  // §13.accounting.calendar-day-T12-utc-unified — TZ-safe ISO-slice.
  const fmt = (d: Date) => formatDateBO(d);
  sheet.getRow(3).getCell(1).value = `Del ${fmt(report.dateFrom)} al ${fmt(report.dateTo)}`;
  sheet.getRow(3).getCell(1).font = arial({ size: 10 });
  sheet.getRow(3).getCell(1).alignment = { horizontal: "center" };
  sheet.mergeCells(`A3:${lastCol}3`);

  // Row 4: PRELIMINAR note (always true for range-based; matching design §6)
  sheet.getRow(4).getCell(1).value =
    "ESTADO PRELIMINAR — basado en datos no confirmados";
  sheet.getRow(4).getCell(1).font = arial({ bold: true, size: 9, color: STYLE.preliminary });
  sheet.getRow(4).getCell(1).alignment = { horizontal: "center" };
  sheet.mergeCells(`A4:${lastCol}4`);

  // Row 5: empty separator
  // (nothing to write)

  // Row 6: merged pair headers
  // A6:A7 vertical merge = "Código"
  // B6:B7 vertical merge = "Cuenta"
  // C6:D6 = "Sumas", E6:F6 = "Saldos", G6:H6 = "Ajustes",
  // I6:J6 = "Saldos Ajustados", K6:L6 = "Resultados", M6:N6 = "Balance General"
  const pairHeaders = [
    { startCol: "C", endCol: "D", label: "Sumas" },
    { startCol: "E", endCol: "F", label: "Saldos" },
    { startCol: "G", endCol: "H", label: "Ajustes" },
    { startCol: "I", endCol: "J", label: "Saldos Ajustados" },
    { startCol: "K", endCol: "L", label: "Resultados" },
    { startCol: "M", endCol: "N", label: "Balance General" },
  ];

  // Vertical merge for Código and Cuenta
  sheet.mergeCells("A6:A7");
  const codeHeaderCell = sheet.getRow(6).getCell(1);
  codeHeaderCell.value = "Código";
  codeHeaderCell.font = arial({ bold: true, size: 8 });
  codeHeaderCell.alignment = { horizontal: "center", vertical: "middle" };

  sheet.mergeCells("B6:B7");
  const cuentaHeaderCell = sheet.getRow(6).getCell(2);
  cuentaHeaderCell.value = "Cuenta";
  cuentaHeaderCell.font = arial({ bold: true, size: 8 });
  cuentaHeaderCell.alignment = { horizontal: "left", vertical: "middle" };

  for (const ph of pairHeaders) {
    sheet.mergeCells(`${ph.startCol}6:${ph.endCol}6`);
    const cell = sheet.getRow(6).getCell(ph.startCol.charCodeAt(0) - 64);
    cell.value = ph.label;
    cell.font = arial({ bold: true, size: 8 });
    cell.alignment = { horizontal: "center" };
  }

  // Row 7: sub-headers Debe/Haber × 6
  const subHeaders = [
    "Debe", "Haber",       // C7, D7 — Sumas
    "Deudor", "Acreedor",  // E7, F7 — Saldos
    "Debe", "Haber",       // G7, H7 — Ajustes
    "Deudor", "Acreedor",  // I7, J7 — Saldos Ajustados
    "Pérdidas", "Ganancias", // K7, L7 — Resultados
    "Activo", "Pas-Pat",   // M7, N7 — Balance General
  ];

  subHeaders.forEach((label, i) => {
    const colIdx = COL_FIRST_NUM + i; // C=3 .. N=14
    const cell = sheet.getRow(7).getCell(colIdx);
    cell.value = label;
    cell.font = arial({ bold: true, size: 8 });
    cell.alignment = { horizontal: "center" };
  });
}

// ── Main export function ──────────────────────────────────────────────────────

/**
 * Exports a WorksheetReport as an XLSX Buffer.
 *
 * @param report   The computed WorksheetReport with Decimal columns
 * @param orgName  Organization display name for the document header
 */
export async function exportWorksheetXlsx(
  report: WorksheetReport,
  orgName: string,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Avicont IA";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Hoja de Trabajo", {
    pageSetup: {
      paperSize: 9, // A4
      orientation: "landscape",
      fitToPage: true,
    },
  });

  // Column widths: A=10 (Código), B=34 (Cuenta), C..N=14 each (numeric)
  sheet.columns = [
    { key: "codigo", width: 10 },
    { key: "cuenta", width: 34 },
    ...Array.from({ length: 12 }, (_, i) => ({ key: `col${i + 3}`, width: 14 })),
  ] as ExcelJS.Column[];

  writeDocumentHeader(sheet, report, orgName, "N");

  let rowNum = 8; // first data row

  // Canonical group order: ACTIVO, PASIVO, PATRIMONIO, INGRESO, GASTO
  for (const group of report.groups) {
    // Group header
    writeGroupHeaderRow(sheet, rowNum++, group.accountType);

    // Detail rows
    for (const row of group.rows) {
      writeAccountRow(sheet, rowNum++, row);
    }

    // Group subtotal
    writeSubtotalRow(sheet, rowNum++, `Total ${group.accountType}`, group.subtotals);
  }

  // Carry-over row (Ganancia/Pérdida del Ejercicio) — treated as a detail row
  if (report.carryOverRow) {
    writeAccountRow(sheet, rowNum++, report.carryOverRow);
  }

  // Grand totals
  writeGrandTotalRow(sheet, rowNum++, report.grandTotals);

  // Footer
  const generatedAt = new Date().toLocaleString("es-BO", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const footerRow = sheet.getRow(rowNum + 2);
  footerRow.getCell(1).value = `Generado: ${generatedAt}`;
  footerRow.getCell(1).font = arial({ size: 7, italic: true, color: STYLE.textMuted });

  // Frozen pane: columns A+B frozen (xSplit=2), rows 1-7 frozen (ySplit=7)
  sheet.views = [{ state: "frozen", xSplit: 2, ySplit: 7 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
