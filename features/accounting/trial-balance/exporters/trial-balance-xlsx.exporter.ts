/**
 * XLSX exporter for Balance de Comprobación de Sumas y Saldos.
 *
 * Sheet: "Sumas y Saldos"
 * Rows 1-5: header block (title, empresa, NIT/dir, period, expresado)
 * Row 6: empty OR imbalance warning (red fill)
 * Row 7: column headers (bold, bottom border)
 * Row 8+: data rows
 * Last row: TOTAL (bold, top border, merged A-C)
 * Frozen pane: xSplit=3, ySplit=7
 * numFmt: "#,##0.00;(#,##0.00)"
 * Column widths: A=6, B=12, C=44, D-G=16
 * Zero detail rows → empty string; totals → numeric 0 (rendered as 0.00 via numFmt)
 */

import ExcelJS from "exceljs";
import type { TrialBalanceReport } from "../trial-balance.types";

// ── Constants ─────────────────────────────────────────────────────────────────

const NUMBER_FORMAT = "#,##0.00;(#,##0.00)";
const SHEET_NAME = "Sumas y Saldos";

const STYLE = {
  text: "000000",
  border: "000000",
  danger: "FFB91C1C",    // red ARGB
  dangerBg: "FFFEF2F2",  // light red background
} as const;

// Column indices (1-based for ExcelJS)
const COL_NUM = 1;       // A — N°
const COL_CODE = 2;      // B — Código
const COL_NAME = 3;      // C — Cuenta
const COL_SD = 4;        // D — Sumas Debe
const COL_SH = 5;        // E — Sumas Haber
const COL_SALD_D = 6;    // F — Saldo Deudor
const COL_SALD_A = 7;    // G — Saldo Acreedor
const COL_LAST = 7;

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
    size: opts.size ?? 9,
    color: { argb: opts.color ?? STYLE.text },
  };
}

// ── Border helpers ────────────────────────────────────────────────────────────

function thinBottom(): Partial<ExcelJS.Borders> {
  return { bottom: { style: "thin", color: { argb: STYLE.border } } };
}

function thinTop(): Partial<ExcelJS.Borders> {
  return { top: { style: "thin", color: { argb: STYLE.border } } };
}

// ── Decimal cell writer ───────────────────────────────────────────────────────

type DecimalLike = { isZero(): boolean; toNumber(): number };

function writeDecimalCell(
  cell: ExcelJS.Cell,
  decimal: DecimalLike,
  opts: { bold?: boolean; isTotal?: boolean },
): void {
  if (decimal.isZero() && !opts.isTotal) {
    cell.value = "";
  } else {
    cell.value = decimal.toNumber(); // toNumber() allowed ONLY at display boundary
    cell.numFmt = NUMBER_FORMAT;
  }
  cell.font = arial({ bold: opts.bold, size: 9 });
  cell.alignment = { horizontal: "right" };
}

// ── Date formatter ────────────────────────────────────────────────────────────

function fmtDate(d: Date): string {
  return d.toLocaleDateString("es-BO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/La_Paz",
  });
}

// ── Main export function ──────────────────────────────────────────────────────

/**
 * Exports a TrialBalanceReport as an XLSX Buffer.
 *
 * @param report     The computed TrialBalanceReport
 * @param orgName    Organization display name
 * @param orgNit     NIT/tax-id (optional)
 * @param orgAddress Physical address (optional)
 */
export async function exportTrialBalanceXlsx(
  report: TrialBalanceReport,
  orgName: string,
  orgNit?: string,
  orgAddress?: string,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Avicont IA";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(SHEET_NAME, {
    pageSetup: {
      paperSize: 9, // A4
      orientation: "portrait",
      fitToPage: true,
    },
  });

  // Column widths
  sheet.columns = [
    { key: "num",  width: 6  },  // A — N°
    { key: "code", width: 12 },  // B — Código
    { key: "name", width: 44 },  // C — Cuenta
    { key: "sd",   width: 16 },  // D — Sumas Debe
    { key: "sh",   width: 16 },  // E — Sumas Haber
    { key: "sdd",  width: 16 },  // F — Saldo Deudor
    { key: "sda",  width: 16 },  // G — Saldo Acreedor
  ] as ExcelJS.Column[];

  const lastCol = "G";

  // ── Header block: rows 1-5 ──
  // Row 1: bold centered title
  sheet.mergeCells(`A1:${lastCol}1`);
  const titleCell = sheet.getRow(1).getCell(1);
  titleCell.value = "BALANCE DE COMPROBACIÓN DE SUMAS Y SALDOS";
  titleCell.font = arial({ bold: true, size: 12 });
  titleCell.alignment = { horizontal: "center" };

  // Row 2: Empresa
  sheet.mergeCells(`A2:${lastCol}2`);
  const empresaCell = sheet.getRow(2).getCell(1);
  empresaCell.value = `Empresa: ${orgName}`;
  empresaCell.font = arial({ bold: true, size: 10 });
  empresaCell.alignment = { horizontal: "center" };

  // Row 3: NIT / Dirección (graceful omission)
  const nitPart = orgNit ? `NIT: ${orgNit}` : null;
  const addrPart = orgAddress ? `Dirección: ${orgAddress}` : null;
  const line3Parts = [nitPart, addrPart].filter(Boolean);
  if (line3Parts.length > 0) {
    sheet.mergeCells(`A3:${lastCol}3`);
    const line3Cell = sheet.getRow(3).getCell(1);
    line3Cell.value = line3Parts.join(" · ");
    line3Cell.font = arial({ size: 9 });
    line3Cell.alignment = { horizontal: "center" };
  }

  // Row 4: Period range
  sheet.mergeCells(`A4:${lastCol}4`);
  const periodCell = sheet.getRow(4).getCell(1);
  periodCell.value = `DEL ${fmtDate(report.dateFrom)} AL ${fmtDate(report.dateTo)}`;
  periodCell.font = arial({ size: 9 });
  periodCell.alignment = { horizontal: "center" };

  // Row 5: Expresado en Bolivianos
  sheet.mergeCells(`A5:${lastCol}5`);
  const expresadoCell = sheet.getRow(5).getCell(1);
  expresadoCell.value = "(Expresado en Bolivianos)";
  expresadoCell.font = arial({ size: 9, italic: true });
  expresadoCell.alignment = { horizontal: "center" };

  // ── Row 6: imbalance warning OR empty ──
  if (report.imbalanced) {
    sheet.mergeCells(`A6:${lastCol}6`);
    const warnCell = sheet.getRow(6).getCell(1);
    warnCell.value = `Balance desbalanceado — Delta Sumas: ${report.deltaSumas.toFixed(2)} · Delta Saldos: ${report.deltaSaldos.toFixed(2)}`;
    warnCell.font = arial({ bold: true, size: 9, color: STYLE.danger });
    warnCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: STYLE.dangerBg },
    };
    warnCell.alignment = { horizontal: "center" };
  }

  // ── Row 7: column headers ──
  const headerRow = sheet.getRow(7);
  const headers = ["N°", "Código", "Cuenta", "Sumas Debe", "Sumas Haber", "Saldo Deudor", "Saldo Acreedor"];
  headers.forEach((label, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = label;
    cell.font = arial({ bold: true, size: 9 });
    cell.alignment = { horizontal: "center" };
    cell.border = thinBottom();
  });

  // ── Data rows (row 8+) ──
  let rowNum = 8;

  report.rows.forEach((row, idx) => {
    const excelRow = sheet.getRow(rowNum++);

    // N°
    excelRow.getCell(COL_NUM).value = idx + 1;
    excelRow.getCell(COL_NUM).font = arial({ size: 9 });
    excelRow.getCell(COL_NUM).alignment = { horizontal: "center" };

    // Código
    excelRow.getCell(COL_CODE).value = row.code;
    excelRow.getCell(COL_CODE).font = arial({ size: 9 });

    // Cuenta
    excelRow.getCell(COL_NAME).value = row.name;
    excelRow.getCell(COL_NAME).font = arial({ size: 9 });

    // Numeric columns D-G
    writeDecimalCell(excelRow.getCell(COL_SD), row.sumasDebe, { isTotal: false });
    writeDecimalCell(excelRow.getCell(COL_SH), row.sumasHaber, { isTotal: false });
    writeDecimalCell(excelRow.getCell(COL_SALD_D), row.saldoDeudor, { isTotal: false });
    writeDecimalCell(excelRow.getCell(COL_SALD_A), row.saldoAcreedor, { isTotal: false });
  });

  // ── TOTAL row ──
  const totalRow = sheet.getRow(rowNum++);

  // Merge A-C for TOTAL label
  sheet.mergeCells(`A${totalRow.number}:C${totalRow.number}`);
  const totalLabelCell = totalRow.getCell(1);
  totalLabelCell.value = "TOTAL";
  totalLabelCell.font = arial({ bold: true, size: 9 });
  totalLabelCell.alignment = { horizontal: "left" };
  totalLabelCell.border = thinTop();

  // Numeric totals D-G
  writeDecimalCell(totalRow.getCell(COL_SD), report.totals.sumasDebe, { bold: true, isTotal: true });
  writeDecimalCell(totalRow.getCell(COL_SH), report.totals.sumasHaber, { bold: true, isTotal: true });
  writeDecimalCell(totalRow.getCell(COL_SALD_D), report.totals.saldoDeudor, { bold: true, isTotal: true });
  writeDecimalCell(totalRow.getCell(COL_SALD_A), report.totals.saldoAcreedor, { bold: true, isTotal: true });

  // Apply top border to numeric total cells
  for (let c = COL_SD; c <= COL_LAST; c++) {
    totalRow.getCell(c).border = thinTop();
  }

  // ── Frozen pane: xSplit=3 (lock N°+Código+Cuenta), ySplit=7 (lock header rows) ──
  sheet.views = [{ state: "frozen", xSplit: 3, ySplit: 7 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
