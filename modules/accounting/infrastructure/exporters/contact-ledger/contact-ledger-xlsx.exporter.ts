/**
 * XLSX exporter for Libro Mayor por Contacto.
 *
 * Sheet: "Libro Mayor por Contacto"
 * Rows 1-6: header block (title, empresa, NIT/dir, contacto, período, expresado)
 * Row 7: column headers (8 cols — bold, bottom border)
 * Row 8: opening balance row (decorativa — sólo si openingBalance !== "0.00")
 * Row 8+ (o 9+): data rows
 * Frozen pane: xSplit=0, ySplit=7
 * numFmt: "#,##0.00;(#,##0.00)"
 *
 * Diferencia clave vs sister `ledger-xlsx.exporter.ts` (7 cols): adiciona
 * columna `Estado` derivada del status del documento (Pagado/Parcial/
 * Pendiente/ATRASADO/Sin auxiliar/—). Tipo cell también humaniza
 * (Cobranza/Pago/voucherTypeHuman).
 *
 * Sister precedent (clone-adapt) per [[paired_sister_default_no_surface]]:
 *   modules/accounting/infrastructure/exporters/ledger/ledger-xlsx.exporter.ts
 *
 * Subdir `contact-ledger/` per design D6 + [[named_rule_immutability]] —
 * preserva α17 sentinel inmutable.
 */

import ExcelJS from "exceljs";
import Decimal from "decimal.js";
import { formatDateBO } from "@/lib/date-utils";
import type { ContactLedgerEntry } from "@/modules/accounting/presentation/dto/ledger.types";

// ── Constants ─────────────────────────────────────────────────────────────────

const NUMBER_FORMAT = "#,##0.00;(#,##0.00)";
const SHEET_NAME = "Libro Mayor por Contacto";

const STYLE = {
  text: "000000",
  border: "000000",
} as const;

// Column indices (1-based for ExcelJS) — 8 cols vs sister 7.
const COL_DATE = 1;     // A — Fecha
const COL_TYPE = 2;     // B — Tipo
const COL_NUM = 3;      // C — Nº
const COL_STATUS = 4;   // D — Estado  (NEW vs sister)
const COL_DESC = 5;     // E — Descripción
const COL_DEBIT = 6;    // F — Debe
const COL_CREDIT = 7;   // G — Haber
const COL_BALANCE = 8;  // H — Saldo

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

// ── Tipo cell derivation (parity con PDF exporter + UI page-client) ──────────

function humanPaymentMethod(
  pm: string | null,
  bank: string | null,
): string {
  switch (pm) {
    case "EFECTIVO":
      return "efectivo";
    case "TRANSFERENCIA":
      return bank ? `transferencia ${bank}` : "transferencia";
    case "CHEQUE":
      return "cheque";
    case "DEPOSITO":
      return bank ? `depósito ${bank}` : "depósito";
    default:
      return pm ?? "";
  }
}

function renderTipo(entry: ContactLedgerEntry): string {
  const src = entry.sourceType?.toLowerCase() ?? null;
  // BF3 — direction-aware: producción usa `sourceType="payment"` para AMBAS
  // direcciones (cobranza/pago). `paymentDirection` ("COBRO"|"PAGO") es el
  // discriminador real. paymentDirection=null cae a "Pago" para back-compat
  // con fixtures legacy.
  if (src === "payment" || src === "receipt") {
    const pm = humanPaymentMethod(entry.paymentMethod, entry.bankAccountName);
    const isCobranza = src === "receipt" || entry.paymentDirection === "COBRO";
    const label = isCobranza ? "Cobranza" : "Pago";
    return pm ? `${label} (${pm})` : label;
  }
  if (src === "sale") {
    return entry.voucherTypeHuman || "Venta";
  }
  if (src === "purchase") {
    return entry.voucherTypeHuman || "Compra";
  }
  return "Ajuste";
}

// ── Estado cell derivation ────────────────────────────────────────────────────

function renderEstado(entry: ContactLedgerEntry): string {
  if (entry.withoutAuxiliary) return "Sin auxiliar";
  const status = entry.status;
  if (status == null) return "—";

  if (
    (status === "PENDING" || status === "PARTIAL") &&
    entry.dueDate &&
    new Date(entry.dueDate) < new Date()
  ) {
    return "ATRASADO";
  }

  switch (status) {
    case "PAID":
      return "Pagado";
    case "PARTIAL":
      return "Parcial";
    case "PENDING":
      return "Pendiente";
    case "VOIDED":
    case "CANCELLED":
      return "Anulado";
    default:
      return status;
  }
}

// ── Main export function ──────────────────────────────────────────────────────

export interface ContactLedgerXlsxOptions {
  contactName: string;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string; // YYYY-MM-DD
  openingBalance: string;
}

/**
 * Exporta un Libro Mayor por Contacto como XLSX Buffer (8 cols).
 *
 * @param entries    ContactLedgerEntry[] — el reporte completo (NO paginado).
 * @param opts       Cabecera + opening balance:
 *                     - contactName → fila 4 ("Contacto: …").
 *                     - dateFrom / dateTo (YYYY-MM-DD) → fila 5.
 *                     - openingBalance → si !== "0.00", fila decorativa antes
 *                       de los movimientos.
 * @param orgName    Organization display name (required).
 * @param orgNit     NIT/tax-id (optional).
 * @param orgAddress Dirección (optional).
 * @param orgCity    Ciudad (optional).
 */
export async function exportContactLedgerXlsx(
  entries: ContactLedgerEntry[],
  opts: ContactLedgerXlsxOptions,
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
    { key: "type",    width: 22 },  // B — Tipo (más ancho para "Cobranza (transferencia BNB)")
    { key: "num",     width: 16 },  // C — Nº
    { key: "status",  width: 14 },  // D — Estado (NEW vs sister)
    { key: "desc",    width: 34 },  // E — Descripción
    { key: "debit",   width: 16 },  // F — Debe
    { key: "credit",  width: 16 },  // G — Haber
    { key: "balance", width: 16 },  // H — Saldo
  ] as ExcelJS.Column[];

  const lastCol = "H"; // 8va columna

  // ── Header block: rows 1-6 ──

  // Row 1: bold centered title
  sheet.mergeCells(`A1:${lastCol}1`);
  const titleCell = sheet.getRow(1).getCell(1);
  titleCell.value = "LIBRO MAYOR POR CONTACTO";
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

  // Row 4: Contacto
  sheet.mergeCells(`A4:${lastCol}4`);
  const contactoCell = sheet.getRow(4).getCell(1);
  contactoCell.value = `Contacto: ${opts.contactName}`;
  contactoCell.font = arial({ bold: true, size: 10 });
  contactoCell.alignment = { horizontal: "center" };

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

  // ── Row 7: column headers (8 cols) ──
  const headerRow = sheet.getRow(7);
  const headers = [
    "Fecha",
    "Tipo",
    "Nº",
    "Estado",
    "Descripción",
    "Debe",
    "Haber",
    "Saldo",
  ];
  headers.forEach((label, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = label;
    cell.font = arial({ bold: true, size: 9 });
    // Numéricas (Debe/Haber/Saldo — idx 5,6,7) alineadas right; resto center.
    cell.alignment = { horizontal: i >= 5 ? "right" : "center" };
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
    openingRow.getCell(COL_STATUS).value = "—";
    openingRow.getCell(COL_STATUS).alignment = { horizontal: "center" };
    openingRow.getCell(COL_STATUS).font = arial({ size: 9 });
    openingRow.getCell(COL_DESC).value = "Saldo inicial acumulado";
    openingRow.getCell(COL_DESC).font = arial({
      bold: true,
      italic: true,
      size: 9,
    });
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

    excelRow.getCell(COL_TYPE).value = renderTipo(entry);
    excelRow.getCell(COL_TYPE).font = arial({ size: 9 });
    excelRow.getCell(COL_TYPE).alignment = { horizontal: "left" };

    excelRow.getCell(COL_NUM).value = entry.displayNumber;
    excelRow.getCell(COL_NUM).font = arial({ size: 9 });

    excelRow.getCell(COL_STATUS).value = renderEstado(entry);
    excelRow.getCell(COL_STATUS).font = arial({ size: 9 });
    excelRow.getCell(COL_STATUS).alignment = { horizontal: "center" };

    excelRow.getCell(COL_DESC).value = entry.description;
    excelRow.getCell(COL_DESC).font = arial({ size: 9 });

    writeMoneyCell(excelRow.getCell(COL_DEBIT), entry.debit);
    writeMoneyCell(excelRow.getCell(COL_CREDIT), entry.credit);
    // Balance siempre se muestra (running cumulative — incluso 0 carry semantics).
    writeMoneyCell(excelRow.getCell(COL_BALANCE), entry.balance, {
      forceShow: true,
    });
  });

  // ── Frozen pane: lock header rows (ySplit=7) ──
  sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 7 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
