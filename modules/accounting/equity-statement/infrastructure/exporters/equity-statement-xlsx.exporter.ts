import ExcelJS from "exceljs";
import type { EquityStatement } from "../../domain/equity-statement.types";
import { COLUMNS_ORDER, COLUMN_LABELS } from "../../domain/equity-statement.builder";

// ── Constants ─────────────────────────────────────────────────────────────────

const NUMBER_FORMAT = "#,##0.00;(#,##0.00)";
const SHEET_NAME = "EEPN";

const STYLE = {
  text: "000000",
  danger: "FFB91C1C",
  dangerBg: "FFFEF2F2",
} as const;

// ── Font helpers ──────────────────────────────────────────────────────────────

function arial(opts: { bold?: boolean; size?: number; italic?: boolean; color?: string }): Partial<ExcelJS.Font> {
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

function setCell(row: ExcelJS.Row, col: number, value: ExcelJS.CellValue, font: Partial<ExcelJS.Font>, numFmt?: string, border?: Partial<ExcelJS.Borders>) {
  const cell = row.getCell(col);
  cell.value = value;
  cell.font = font;
  if (numFmt) cell.numFmt = numFmt;
  if (border) cell.border = border;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function exportEquityStatementXlsx(
  statement: EquityStatement,
  orgName: string,
  orgNit?: string,
  orgAddress?: string,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(SHEET_NAME);

  // Determine visible columns
  const visibleCols = COLUMNS_ORDER.filter((key) => {
    const col = statement.columns.find((c) => c.key === key);
    return col?.visible ?? key !== "OTROS_PATRIMONIO";
  });

  const totalCols = 1 + visibleCols.length + 1; // Concepto + numerics + Total

  // Column widths
  ws.getColumn(1).width = 32;
  for (let i = 2; i <= totalCols; i++) {
    ws.getColumn(i).width = i === totalCols ? 18 : 16;
  }

  // Row 1 — Title
  const r1 = ws.addRow([]);
  ws.mergeCells(`A1:${ws.getColumn(totalCols).letter}1`);
  setCell(r1, 1, "ESTADO DE EVOLUCIÓN DEL PATRIMONIO NETO", arial({ bold: true, size: 12 }));
  r1.getCell(1).alignment = { horizontal: "center" };

  // Row 2 — Org name
  const r2 = ws.addRow([]);
  ws.mergeCells(`A2:${ws.getColumn(totalCols).letter}2`);
  setCell(r2, 1, `Empresa: ${orgName}`, arial({ bold: true, size: 10 }));
  r2.getCell(1).alignment = { horizontal: "center" };

  // Row 3 — NIT/address
  const r3 = ws.addRow([]);
  ws.mergeCells(`A3:${ws.getColumn(totalCols).letter}3`);
  const line3Parts = [orgNit ? `NIT: ${orgNit}` : null, orgAddress ? `Dirección: ${orgAddress}` : null].filter(Boolean);
  setCell(r3, 1, line3Parts.join(" · "), arial({ size: 9 }));
  r3.getCell(1).alignment = { horizontal: "center" };

  // Row 4 — Date range
  const r4 = ws.addRow([]);
  ws.mergeCells(`A4:${ws.getColumn(totalCols).letter}4`);
  const fmtDate = (d: Date) => d.toLocaleDateString("es-BO", { year: "numeric", month: "2-digit", day: "2-digit" });
  setCell(r4, 1, `DEL ${fmtDate(statement.dateFrom)} AL ${fmtDate(statement.dateTo)}`, arial({ size: 9 }));
  r4.getCell(1).alignment = { horizontal: "center" };

  // Row 5 — Expresado en
  const r5 = ws.addRow([]);
  ws.mergeCells(`A5:${ws.getColumn(totalCols).letter}5`);
  setCell(r5, 1, "(Expresado en Bolivianos)", arial({ size: 9, italic: true }));
  r5.getCell(1).alignment = { horizontal: "center" };

  // Row 6 — Warning banner if imbalanced or preliminary
  const r6 = ws.addRow([]);
  ws.mergeCells(`A6:${ws.getColumn(totalCols).letter}6`);
  if (statement.imbalanced) {
    const deltaFmt = Number(statement.imbalanceDelta.toString()).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    setCell(
      r6,
      1,
      `ADVERTENCIA: Diferencia patrimonial sin clasificar Bs. ${deltaFmt} — probables aportes de capital, distribuciones o constitución de reservas`,
      arial({ bold: true, size: 9, color: STYLE.danger }),
    );
    r6.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: STYLE.dangerBg } };
  } else if (statement.preliminary) {
    setCell(r6, 1, "PRELIMINAR — Este reporte cubre un período no cerrado", arial({ bold: true, size: 9, color: "FF92400E" }));
    r6.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
  }

  // Row 7 — Column headers
  const r7 = ws.addRow([]);
  setCell(r7, 1, "Concepto", arial({ bold: true, size: 9 }), undefined, thinBottom());
  r7.getCell(1).alignment = { horizontal: "left" };
  let colIdx = 2;
  for (const key of visibleCols) {
    setCell(r7, colIdx, COLUMN_LABELS[key], arial({ bold: true, size: 9 }), undefined, thinBottom());
    r7.getCell(colIdx).alignment = { horizontal: "center" };
    colIdx++;
  }
  setCell(r7, colIdx, "Total Patrimonio", arial({ bold: true, size: 9 }), undefined, thinBottom());
  r7.getCell(colIdx).alignment = { horizontal: "center" };

  // Rows 8+ — Data rows (N-row; bold/border on SALDO_FINAL via key, not index)
  statement.rows.forEach((row) => {
    const isFinal = row.key === "SALDO_FINAL";
    const dataRow = ws.addRow([]);
    setCell(dataRow, 1, row.label, arial({ bold: isFinal, size: 9 }), undefined, isFinal ? thinTop() : undefined);

    colIdx = 2;
    for (const key of visibleCols) {
      const cell = row.cells.find((c) => c.column === key);
      const amount = cell?.amount;
      if (!amount || (amount.isZero() && !isFinal)) {
        // Zero in detail rows → empty; zero in total row → show via numFmt
        const exCell = dataRow.getCell(colIdx);
        if (isFinal) {
          exCell.value = 0;
          exCell.numFmt = NUMBER_FORMAT;
          exCell.font = arial({ bold: true, size: 9 });
        } else {
          exCell.value = "";
          exCell.font = arial({ size: 9 });
        }
      } else {
        const numVal = Number(amount.toString());
        setCell(dataRow, colIdx, numVal, arial({ bold: isFinal, size: 9 }), NUMBER_FORMAT, isFinal ? thinTop() : undefined);
      }
      colIdx++;
    }

    // Total column
    const totalVal = row.total.isZero() && !isFinal ? "" : Number(row.total.toString());
    if (totalVal === "") {
      dataRow.getCell(colIdx).value = "";
      dataRow.getCell(colIdx).font = arial({ size: 9 });
    } else {
      setCell(dataRow, colIdx, totalVal as number, arial({ bold: isFinal, size: 9 }), NUMBER_FORMAT, isFinal ? thinTop() : undefined);
    }
  });

  // Frozen pane
  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 7 }];

  // Page setup A4 landscape
  ws.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
