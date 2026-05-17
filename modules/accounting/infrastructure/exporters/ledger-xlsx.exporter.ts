/**
 * XLSX exporter for Libro Mayor.
 *
 * Sheet: "Libro Mayor"
 * Rows 1-6: header block (title, empresa, NIT/dir, cuenta, período, expresado)
 * Row 7: column headers (bold, bottom border)
 * Row 8: opening balance row (decorative — sólo si openingBalance !== "0.00")
 * Row 8+ (o 9+): data rows
 * Frozen pane: xSplit=0, ySplit=7 (lock header rows only — tabla angosta,
 *              no necesita lock horizontal)
 * numFmt: "#,##0.00;(#,##0.00)"
 * Column widths: A=12 (Fecha), B=8 (Tipo), C=16 (Nº), D=44 (Descripción),
 *                E-G=16 (Debe/Haber/Saldo)
 *
 * Zero data cells → empty string; opening balance & balance running → siempre
 * numéricos (carry-over y running balance están definidos aun cuando son 0).
 *
 * Sister precedent: `modules/accounting/trial-balance/infrastructure/
 * exporters/trial-balance-xlsx.exporter.ts`.
 */

import ExcelJS from "exceljs";
import Decimal from "decimal.js";
import { formatDateBO } from "@/lib/date-utils";
import type { LedgerEntry } from "@/modules/accounting/presentation/dto/ledger.types";

// ── Constants ─────────────────────────────────────────────────────────────────

const NUMBER_FORMAT = "#,##0.00;(#,##0.00)";
const SHEET_NAME = "Libro Mayor";

const STYLE = {
  text: "000000",
  border: "000000",
} as const;

// Column indices (1-based for ExcelJS)
const COL_DATE = 1;        // A — Fecha
const COL_TYPE = 2;        // B — Tipo
const COL_NUM = 3;         // C — Nº
const COL_DESC = 4;        // D — Descripción
const COL_DEBIT = 5;       // E — Debe
const COL_CREDIT = 6;      // F — Haber
const COL_BALANCE = 7;     // G — Saldo

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

// ── Decimal cell writer ───────────────────────────────────────────────────────
//
// LedgerEntry.{debit,credit,balance} y openingBalance vienen serializados como
// `string` desde el service. Coerce a number via Decimal para mantener
// precisión, y delego el formato es-BO al `numFmt` de Excel.

function writeMoneyCell(
  cell: ExcelJS.Cell,
  amount: string,
  opts: { bold?: boolean; forceShow?: boolean } = {},
): void {
  const dec = new Decimal(amount);
  if (dec.isZero() && !opts.forceShow) {
    cell.value = "";
  } else {
    cell.value = dec.toNumber();
    cell.numFmt = NUMBER_FORMAT;
  }
  cell.font = arial({ bold: opts.bold, size: 9 });
  cell.alignment = { horizontal: "right" };
}

// ── Date formatter ────────────────────────────────────────────────────────────

function fmtDate(d: string): string {
  return formatDateBO(d);
}

// ── Main export function ──────────────────────────────────────────────────────

export interface LedgerXlsxOptions {
  accountCode: string;
  accountName: string;
  dateFrom: string;  // YYYY-MM-DD
  dateTo: string;    // YYYY-MM-DD
  openingBalance: string;
}

/**
 * Exports a Libro Mayor (cuenta + período) as an XLSX Buffer.
 *
 * @param entries    LedgerEntry[] — el reporte completo (NO paginado, doc §8).
 * @param opts       Cabecera + opening balance:
 *                     - accountCode / accountName → fila 4 ("Cuenta: …").
 *                     - dateFrom / dateTo (YYYY-MM-DD) → fila 5.
 *                     - openingBalance → si !== "0.00", fila decorativa antes
 *                       de los movimientos.
 * @param orgName    Organization display name (required)
 * @param orgNit     NIT/tax-id (optional)
 * @param orgAddress Dirección (optional)
 * @param orgCity    Ciudad (optional)
 */
export async function exportLedgerXlsx(
  entries: LedgerEntry[],
  opts: LedgerXlsxOptions,
  orgName: string,
  orgNit?: string,
  orgAddress?: string,
  orgCity?: string,
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
    { key: "date",    width: 12 },  // A — Fecha
    { key: "type",    width: 8  },  // B — Tipo
    { key: "num",     width: 16 },  // C — Nº
    { key: "desc",    width: 44 },  // D — Descripción
    { key: "debit",   width: 16 },  // E — Debe
    { key: "credit",  width: 16 },  // F — Haber
    { key: "balance", width: 16 },  // G — Saldo
  ] as ExcelJS.Column[];

  const lastCol = "G";

  // ── Header block: rows 1-6 ──

  // Row 1: bold centered title
  sheet.mergeCells(`A1:${lastCol}1`);
  const titleCell = sheet.getRow(1).getCell(1);
  titleCell.value = "LIBRO MAYOR";
  titleCell.font = arial({ bold: true, size: 12 });
  titleCell.alignment = { horizontal: "center" };

  // Row 2: Empresa
  sheet.mergeCells(`A2:${lastCol}2`);
  const empresaCell = sheet.getRow(2).getCell(1);
  empresaCell.value = `Empresa: ${orgName}`;
  empresaCell.font = arial({ bold: true, size: 10 });
  empresaCell.alignment = { horizontal: "center" };

  // Row 3: NIT / Dirección / Ciudad — graceful omission
  const nitPart = orgNit ? `NIT: ${orgNit}` : null;
  const addrPart = orgAddress ? `Dirección: ${orgAddress}` : null;
  const cityPart = orgCity ? orgCity : null;
  const line3Parts = [nitPart, addrPart, cityPart].filter(Boolean);
  if (line3Parts.length > 0) {
    sheet.mergeCells(`A3:${lastCol}3`);
    const line3Cell = sheet.getRow(3).getCell(1);
    line3Cell.value = line3Parts.join(" · ");
    line3Cell.font = arial({ size: 9 });
    line3Cell.alignment = { horizontal: "center" };
  }

  // Row 4: Cuenta
  sheet.mergeCells(`A4:${lastCol}4`);
  const cuentaCell = sheet.getRow(4).getCell(1);
  cuentaCell.value = `Cuenta: ${opts.accountCode} — ${opts.accountName}`;
  cuentaCell.font = arial({ bold: true, size: 10 });
  cuentaCell.alignment = { horizontal: "center" };

  // Row 5: Período
  sheet.mergeCells(`A5:${lastCol}5`);
  const periodCell = sheet.getRow(5).getCell(1);
  periodCell.value = `DEL ${fmtDate(opts.dateFrom)} AL ${fmtDate(opts.dateTo)}`;
  periodCell.font = arial({ size: 9 });
  periodCell.alignment = { horizontal: "center" };

  // Row 6: Expresado en Bolivianos
  sheet.mergeCells(`A6:${lastCol}6`);
  const expresadoCell = sheet.getRow(6).getCell(1);
  expresadoCell.value = "(Expresado en Bolivianos)";
  expresadoCell.font = arial({ size: 9, italic: true });
  expresadoCell.alignment = { horizontal: "center" };

  // ── Row 7: column headers ──
  const headerRow = sheet.getRow(7);
  const headers = ["Fecha", "Tipo", "Nº", "Descripción", "Debe", "Haber", "Saldo"];
  headers.forEach((label, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = label;
    cell.font = arial({ bold: true, size: 9 });
    cell.alignment = { horizontal: i >= 4 ? "right" : "center" };
    cell.border = thinBottom();
  });

  // ── Data rows (row 8+) ──
  let rowNum = 8;

  // Opening balance decorative row — sólo si openingBalance !== "0.00"
  if (opts.openingBalance !== "0.00") {
    const openingRow = sheet.getRow(rowNum++);
    openingRow.getCell(COL_DATE).value = "—";
    openingRow.getCell(COL_DATE).alignment = { horizontal: "center" };
    openingRow.getCell(COL_DATE).font = arial({ size: 9 });
    openingRow.getCell(COL_TYPE).value = "—";
    openingRow.getCell(COL_TYPE).alignment = { horizontal: "center" };
    openingRow.getCell(COL_TYPE).font = arial({ size: 9 });
    openingRow.getCell(COL_NUM).value = "—";
    openingRow.getCell(COL_NUM).alignment = { horizontal: "center" };
    openingRow.getCell(COL_NUM).font = arial({ size: 9 });
    openingRow.getCell(COL_DESC).value = "Saldo inicial acumulado";
    openingRow.getCell(COL_DESC).font = arial({ bold: true, italic: true, size: 9 });
    openingRow.getCell(COL_DEBIT).value = "";
    openingRow.getCell(COL_CREDIT).value = "";
    writeMoneyCell(openingRow.getCell(COL_BALANCE), opts.openingBalance, {
      bold: true,
      forceShow: true,
    });
  }

  entries.forEach((entry) => {
    const excelRow = sheet.getRow(rowNum++);

    excelRow.getCell(COL_DATE).value = fmtDate(entry.date as unknown as string);
    excelRow.getCell(COL_DATE).font = arial({ size: 9 });
    excelRow.getCell(COL_DATE).alignment = { horizontal: "left" };

    excelRow.getCell(COL_TYPE).value = entry.voucherCode;
    excelRow.getCell(COL_TYPE).font = arial({ size: 9 });
    excelRow.getCell(COL_TYPE).alignment = { horizontal: "center" };

    excelRow.getCell(COL_NUM).value = entry.displayNumber;
    excelRow.getCell(COL_NUM).font = arial({ size: 9 });

    excelRow.getCell(COL_DESC).value = entry.description;
    excelRow.getCell(COL_DESC).font = arial({ size: 9 });

    writeMoneyCell(excelRow.getCell(COL_DEBIT), entry.debit);
    writeMoneyCell(excelRow.getCell(COL_CREDIT), entry.credit);
    // Balance is always shown (running cumulative — even when 0 it carries semantics).
    writeMoneyCell(excelRow.getCell(COL_BALANCE), entry.balance, { forceShow: true });
  });

  // ── Frozen pane: lock header rows (ySplit=7) ──
  // xSplit=0 — la tabla es angosta y el scroll horizontal no requiere lock.
  sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 7 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
