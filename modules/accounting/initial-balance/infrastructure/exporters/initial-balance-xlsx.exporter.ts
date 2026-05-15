import ExcelJS from "exceljs";
import { formatDateBO } from "@/lib/date-utils";
import type { InitialBalanceStatement, InitialBalanceGroup } from "../../domain/initial-balance.types";

// ── Constants ─────────────────────────────────────────────────────────────────

const SHEET_NAME = "Balance Inicial";

/** Matches equity-statement-xlsx.exporter convention: negatives in parens. */
const NUMBER_FORMAT = "#,##0.00;(#,##0.00)";

const STYLE = {
  text: "000000",
  danger: "FFB91C1C",
  dangerBg: "FFFEF2F2",
  muted: "FF6B7280",
  mutedBg: "FFF3F4F6",
} as const;

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

function thinBottom(): Partial<ExcelJS.Borders> {
  return { bottom: { style: "thin", color: { argb: STYLE.text } } };
}

function thinTop(): Partial<ExcelJS.Borders> {
  return { top: { style: "thin", color: { argb: STYLE.text } } };
}

function setCell(
  row: ExcelJS.Row,
  col: number,
  value: ExcelJS.CellValue,
  font: Partial<ExcelJS.Font>,
  numFmt?: string,
  border?: Partial<ExcelJS.Borders>,
) {
  const cell = row.getCell(col);
  cell.value = value;
  cell.font = font;
  if (numFmt) cell.numFmt = numFmt;
  if (border) cell.border = border;
}

// ── Date formatter ────────────────────────────────────────────────────────────

function fmtDateLong(d: Date): string {
  // §13.accounting.calendar-day-T12-utc-unified — TZ-safe ISO-slice.
  // NOTE: name retained as `fmtDateLong` for source-call-site stability, but
  // the format is now numeric DD/MM/YYYY (formatDateBO output). Uniformly
  // numeric across §13 sweep.
  return formatDateBO(d);
}

// ── Group rows helper ─────────────────────────────────────────────────────────

function writeGroup(ws: ExcelJS.Worksheet, group: InitialBalanceGroup, totalCols: number): void {
  const lastCol = totalCols;
  const mergedLetter = ws.getColumn(lastCol).letter;

  // Subtype header row
  const headerRow = ws.addRow([]);
  ws.mergeCells(`A${headerRow.number}:${mergedLetter}${headerRow.number}`);
  setCell(headerRow, 1, group.label, arial({ bold: true, size: 9 }));

  // Detail rows
  for (const row of group.rows) {
    const dr = ws.addRow([]);
    setCell(dr, 1, `  ${row.code} — ${row.name}`, arial({ size: 9 }));
    const amount = Number(row.amount.toString());
    if (row.amount.isZero()) {
      dr.getCell(lastCol).value = "";
      dr.getCell(lastCol).font = arial({ size: 9 });
    } else {
      setCell(dr, lastCol, amount, arial({ size: 9 }), NUMBER_FORMAT);
    }
  }

  // Subtotal row
  const stRow = ws.addRow([]);
  setCell(stRow, 1, `Total ${group.label}`, arial({ bold: true, size: 9 }), undefined, thinTop());
  const subtotalVal = Number(group.subtotal.toString());
  setCell(stRow, lastCol, subtotalVal, arial({ bold: true, size: 9 }), NUMBER_FORMAT, thinTop());
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function exportInitialBalanceXlsx(
  statement: InitialBalanceStatement,
): Promise<Buffer> {
  const { org, dateAt, sections, imbalanced, imbalanceDelta, multipleCA } = statement;
  const [activoSection, pasivoSection] = sections;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(SHEET_NAME);

  // 2 columns: label (A) + amount (B)
  const TOTAL_COLS = 2;
  ws.getColumn(1).width = 40;
  ws.getColumn(2).width = 18;

  const colBLetter = ws.getColumn(TOTAL_COLS).letter; // "B"

  // ── Banner rows ─────────────────────────────────────────────────────────────

  // Row 1 — Razón social
  const r1 = ws.addRow([]);
  ws.mergeCells(`A1:${colBLetter}1`);
  setCell(r1, 1, org.razonSocial, arial({ bold: true, size: 12 }));
  r1.getCell(1).alignment = { horizontal: "center" };

  // Row 2 — NIT
  const r2 = ws.addRow([]);
  ws.mergeCells(`A2:${colBLetter}2`);
  setCell(r2, 1, `NIT: ${org.nit}`, arial({ size: 10 }));
  r2.getCell(1).alignment = { horizontal: "center" };

  // Row 3 — Representante legal
  const r3 = ws.addRow([]);
  ws.mergeCells(`A3:${colBLetter}3`);
  setCell(r3, 1, `Representante Legal: ${org.representanteLegal}`, arial({ size: 9 }));
  r3.getCell(1).alignment = { horizontal: "center" };

  // Row 4 — Dirección
  const r4 = ws.addRow([]);
  ws.mergeCells(`A4:${colBLetter}4`);
  setCell(r4, 1, `Dirección: ${org.direccion}`, arial({ size: 9 }));
  r4.getCell(1).alignment = { horizontal: "center" };

  // Row 5 — Ciudad
  const r5a = ws.addRow([]);
  ws.mergeCells(`A5:${colBLetter}5`);
  setCell(r5a, 1, org.ciudad, arial({ size: 9 }));
  r5a.getCell(1).alignment = { horizontal: "center" };

  // Row 6 — Title
  const r5 = ws.addRow([]);
  ws.mergeCells(`A6:${colBLetter}6`);
  setCell(r5, 1, `BALANCE INICIAL — Al ${fmtDateLong(dateAt)}`, arial({ bold: true, size: 11 }));
  r5.getCell(1).alignment = { horizontal: "center" };

  // Row 7 — Subtitle
  const r6 = ws.addRow([]);
  ws.mergeCells(`A7:${colBLetter}7`);
  setCell(r6, 1, "(Expresado en Bolivianos)", arial({ size: 9, italic: true }));
  r6.getCell(1).alignment = { horizontal: "center" };

  // Row 8 — Imbalance or multiple-CA banner (if applicable)
  const r7 = ws.addRow([]);
  ws.mergeCells(`A8:${colBLetter}8`);
  if (imbalanced) {
    const deltaFmt = Number(imbalanceDelta.toString()).toLocaleString("es-BO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    setCell(
      r7,
      1,
      `ADVERTENCIA: Balance desbalanceado — Diferencia Bs. ${deltaFmt}`,
      arial({ bold: true, size: 9, color: STYLE.danger }),
    );
    r7.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: STYLE.dangerBg } };
  } else if (multipleCA) {
    setCell(
      r7,
      1,
      `AVISO: Se encontraron ${statement.caCount} comprobantes de apertura (CA) — saldos consolidados`,
      arial({ size: 9, color: STYLE.muted }),
    );
    r7.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: STYLE.mutedBg } };
  }

  // Row 8 — blank separator
  ws.addRow([]);

  // ── ACTIVO section ──────────────────────────────────────────────────────────

  // Section header
  const activoHeaderRow = ws.addRow([]);
  ws.mergeCells(`A${activoHeaderRow.number}:${colBLetter}${activoHeaderRow.number}`);
  setCell(activoHeaderRow, 1, "ACTIVO", arial({ bold: true, size: 10 }), undefined, thinBottom());

  for (const group of activoSection.groups) {
    writeGroup(ws, group, TOTAL_COLS);
  }

  // Section total
  const activoTotalRow = ws.addRow([]);
  setCell(activoTotalRow, 1, "TOTAL ACTIVO", arial({ bold: true, size: 10 }), undefined, thinTop());
  setCell(
    activoTotalRow,
    TOTAL_COLS,
    Number(activoSection.sectionTotal.toString()),
    arial({ bold: true, size: 10 }),
    NUMBER_FORMAT,
    thinTop(),
  );

  // Blank separator
  ws.addRow([]);

  // ── PASIVO Y PATRIMONIO section ─────────────────────────────────────────────

  const pasivoHeaderRow = ws.addRow([]);
  ws.mergeCells(`A${pasivoHeaderRow.number}:${colBLetter}${pasivoHeaderRow.number}`);
  setCell(pasivoHeaderRow, 1, "PASIVO Y PATRIMONIO", arial({ bold: true, size: 10 }), undefined, thinBottom());

  for (const group of pasivoSection.groups) {
    writeGroup(ws, group, TOTAL_COLS);
  }

  const pasivoTotalRow = ws.addRow([]);
  setCell(pasivoTotalRow, 1, "TOTAL PASIVO Y PATRIMONIO", arial({ bold: true, size: 10 }), undefined, thinTop());
  setCell(
    pasivoTotalRow,
    TOTAL_COLS,
    Number(pasivoSection.sectionTotal.toString()),
    arial({ bold: true, size: 10 }),
    NUMBER_FORMAT,
    thinTop(),
  );

  // ── Page setup — A4 portrait ────────────────────────────────────────────────
  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
