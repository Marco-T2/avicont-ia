/**
 * PDF exporter for Hoja de Trabajo 12 Columnas.
 *
 * Layout: A4 landscape, single page (no chunking — REQ-12).
 * 14 columns: Código (35pt) + Cuenta (130pt) + 12 numeric (~47pt each).
 * Two header rows: merged pair labels + Debe/Haber sub-labels.
 * Body font: Roboto 7pt.
 *
 * Zero-value convention (Option A — same as XLSX exporter):
 *   - Detail rows: zero → empty string ""
 *   - Subtotal / grand-total rows: zero → "0.00"
 *
 * Contra-accounts: negative Decimal → formatted as (value.toFixed(2)) string.
 *
 * Returns both the Buffer and the docDef for testing/inspection.
 * Reuses registerFonts() + pdfmakeRuntime singleton from pdf.fonts.ts.
 */

import type { TDocumentDefinitions, Content, Watermark } from "pdfmake/interfaces";
import { registerFonts, pdfmakeRuntime } from "../../financial-statements/exporters/pdf.fonts";
import type { WorksheetReport, WorksheetRow, WorksheetTotals } from "../worksheet.types";

// ── Constants ─────────────────────────────────────────────────────────────────

const STYLE = {
  text: "#000000",
  textMuted: "#6b7280",
  border: "#000000",
  danger: "#b91c1c",
  preliminary: "#b45309",
} as const;

// Column widths in pt for pdfmake
const COL_CODIGO = 35;
const COL_CUENTA = 130;
// 12 numeric columns: remaining space divided equally.
// A4 landscape printable area ≈ 728pt (297mm × 2.835 − margins 40pt each side).
// (728 − 35 − 130) / 12 ≈ 47pt
const COL_NUMERIC = 47;

const BODY_SIZE = 7;
const HEADER_SIZE = 7;
const TITLE_SIZE = 12;
const SUBTITLE_SIZE = 9;
const FOOTER_SIZE = 7;

// ── Formatters ────────────────────────────────────────────────────────────────

/**
 * Formats a Decimal for display in a PDF cell using es-BO locale.
 *
 * es-BO format: period as thousands separator, comma as decimal.
 * Example: 207000 → "207.000,00"; -120000 → "(120.000,00)"
 *
 * Option A zero-value rule:
 *   - isTotal=false: zero → ""
 *   - isTotal=true:  zero → "0,00"
 *
 * Non-zero: format with es-BO thousands separator and 2 decimal places.
 * Negative (contra bgActivo): formatted as (abs formatted) with parens.
 */
function fmtDecimal(
  decimal: { isZero(): boolean; isNegative(): boolean; abs(): { toNumber(): number }; toNumber(): number },
  isTotal: boolean,
): string {
  if (decimal.isZero()) {
    return isTotal ? (0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
  }
  if (decimal.isNegative()) {
    const absStr = decimal.abs().toNumber().toLocaleString("es-BO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `(${absStr})`;
  }
  return decimal.toNumber().toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ── Column widths array ───────────────────────────────────────────────────────

function buildWidths(): (string | number)[] {
  return [COL_CODIGO, COL_CUENTA, ...Array(12).fill(COL_NUMERIC)];
}

// ── Cell helpers ──────────────────────────────────────────────────────────────

function numCell(text: string, bold: boolean): Content {
  return {
    text,
    fontSize: BODY_SIZE,
    bold,
    alignment: "right",
    margin: [1, 1, 2, 1],
  } as Content;
}

function labelCell(text: string, bold: boolean, italic?: boolean): Content {
  return {
    text,
    fontSize: BODY_SIZE,
    bold,
    italics: italic ?? false,
    alignment: "left",
    margin: [2, 1, 2, 1],
  } as Content;
}

function headerCell(text: string, colSpan?: number): Content {
  const cell: Record<string, unknown> = {
    text,
    fontSize: HEADER_SIZE,
    bold: true,
    alignment: "center",
    margin: [1, 2, 1, 2],
  };
  if (colSpan) cell.colSpan = colSpan;
  return cell as Content;
}

function emptyCell(): Content {
  return { text: "" } as Content;
}

// ── 12-column value array for a row ──────────────────────────────────────────

function buildValueCells(
  row: WorksheetRow | WorksheetTotals,
  isTotal: boolean,
  bold: boolean,
): Content[] {
  const cols: Array<{ isZero(): boolean; isNegative(): boolean; abs(): { toNumber(): number }; toNumber(): number }> = [
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
  return cols.map((d) => numCell(fmtDecimal(d, isTotal), bold));
}

// ── Table body construction ───────────────────────────────────────────────────

/**
 * Builds the complete pdfmake table body array.
 *
 * Row structure:
 *   [0]: merged pair headers (Sumas / Saldos / Ajustes / Saldos Ajustados / Resultados / BG)
 *   [1]: sub-headers (Debe/Haber × 6)
 *   [2..N]: data rows (group headers, detail rows, subtotals, carry-over, grand totals)
 */
function buildTableBody(report: WorksheetReport): Content[][] {
  const rows: Content[][] = [];

  // ── Header row 1: merged pair labels ──
  rows.push([
    { text: "Código", fontSize: HEADER_SIZE, bold: true, rowSpan: 2, alignment: "center", margin: [1, 3, 1, 3] } as Content,
    { text: "Cuenta", fontSize: HEADER_SIZE, bold: true, rowSpan: 2, alignment: "left", margin: [2, 3, 2, 3] } as Content,
    headerCell("Sumas", 2), emptyCell(),
    headerCell("Saldos", 2), emptyCell(),
    headerCell("Ajustes", 2), emptyCell(),
    headerCell("Saldos Ajustados", 2), emptyCell(),
    headerCell("Resultados", 2), emptyCell(),
    headerCell("Balance General", 2), emptyCell(),
  ]);

  // ── Header row 2: sub-labels ──
  rows.push([
    emptyCell(), emptyCell(), // rowSpan placeholders for Código + Cuenta
    headerCell("Debe"), headerCell("Haber"),
    headerCell("Deudor"), headerCell("Acreedor"),
    headerCell("Debe"), headerCell("Haber"),
    headerCell("Deudor"), headerCell("Acreedor"),
    headerCell("Pérdidas"), headerCell("Ganancias"),
    headerCell("Activo"), headerCell("Pas-Pat"),
  ]);

  // ── Data rows ──
  for (const group of report.groups) {
    // Group header
    rows.push([
      emptyCell(),
      {
        text: group.accountType,
        fontSize: BODY_SIZE,
        bold: true,
        colSpan: 13,
        alignment: "left",
        margin: [2, 2, 2, 2],
      } as Content,
      ...Array(12).fill(emptyCell()),
    ]);

    // Detail rows
    for (const row of group.rows) {
      rows.push([
        labelCell(row.code, false),
        labelCell(row.name, false, row.isCarryOver),
        ...buildValueCells(row, false, false),
      ]);
    }

    // Group subtotal
    rows.push([
      emptyCell(),
      labelCell(`Total ${group.accountType}`, true),
      ...buildValueCells(group.subtotals, true, true),
    ]);
  }

  // Carry-over row
  if (report.carryOverRow) {
    rows.push([
      labelCell(report.carryOverRow.code, true, true),
      labelCell(report.carryOverRow.name, true, true),
      ...buildValueCells(report.carryOverRow, false, true),
    ]);
  }

  // Grand totals
  rows.push([
    emptyCell(),
    labelCell("TOTALES", true),
    ...buildValueCells(report.grandTotals, true, true),
  ]);

  return rows;
}

// ── Row type parallel array (for line drawing) ────────────────────────────────

type RowKind = "header" | "group" | "detail" | "subtotal" | "carry-over" | "total";

function buildRowKinds(report: WorksheetReport): RowKind[] {
  const kinds: RowKind[] = ["header", "header"];
  for (const group of report.groups) {
    kinds.push("group");
    for (const _ of group.rows) {
      kinds.push("detail");
    }
    kinds.push("subtotal");
  }
  if (report.carryOverRow) {
    kinds.push("carry-over");
  }
  kinds.push("total");
  return kinds;
}

// ── Doc definition builder ────────────────────────────────────────────────────

function buildDocDefinition(
  report: WorksheetReport,
  orgName: string,
): TDocumentDefinitions {
  const fmt = (d: Date) =>
    d.toLocaleDateString("es-BO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "America/La_Paz",
    });

  const generatedAt = new Date().toLocaleString("es-BO", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const tableBody = buildTableBody(report);
  const rowKinds = buildRowKinds(report);

  const layout = {
    hLineWidth: (i: number, node: { table: { body: unknown[] } }) => {
      const totalRows = node.table.body.length;
      // Lines below header rows
      if (i === 1 || i === 2) return 0.5;
      // Lines above subtotal / total rows
      const dataIdx = i - 2;
      if (dataIdx >= 0 && dataIdx < rowKinds.length) {
        const kind = rowKinds[dataIdx];
        if (kind === "subtotal" || kind === "total" || kind === "carry-over") return 0.5;
      }
      // Line below last row
      if (i === totalRows) return 0.5;
      return 0;
    },
    vLineWidth: () => 0,
    hLineColor: () => STYLE.border,
    paddingLeft: () => 0,
    paddingRight: () => 0,
    paddingTop: () => 1,
    paddingBottom: () => 1,
  };

  const watermark: Watermark = {
    text: "PRELIMINAR",
    color: STYLE.textMuted,
    opacity: 0.15,
    bold: true,
    italics: false,
  };

  const imbalanceBanner: Content[] = report.imbalanced
    ? [
        {
          text: `Ecuación contable desbalanceada — Delta: ${report.imbalanceDelta.toNumber().toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BOB`,
          fontSize: BODY_SIZE,
          color: STYLE.danger,
          bold: true,
          margin: [0, 0, 0, 4],
        } as Content,
      ]
    : [];

  const content: Content[] = [
    {
      text: "Hoja de Trabajo",
      fontSize: TITLE_SIZE,
      bold: true,
      alignment: "center",
      margin: [0, 0, 0, 2],
    } as Content,
    {
      text: orgName,
      fontSize: SUBTITLE_SIZE,
      bold: true,
      alignment: "center",
      margin: [0, 0, 0, 2],
    } as Content,
    {
      text: `Del ${fmt(report.dateFrom)} al ${fmt(report.dateTo)}`,
      fontSize: SUBTITLE_SIZE,
      color: STYLE.textMuted,
      alignment: "center",
      margin: [0, 0, 0, 6],
    } as Content,
    ...imbalanceBanner,
    {
      table: {
        widths: buildWidths(),
        body: tableBody,
        headerRows: 2,
        dontBreakRows: false,
      },
      layout,
    } as Content,
  ];

  const docDef: TDocumentDefinitions = {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [20, 40, 20, 40],

    watermark,

    footer: (_currentPage: number, _pageCount: number): Content =>
      ({
        columns: [
          {
            text: `Generado: ${generatedAt}`,
            fontSize: FOOTER_SIZE,
            color: STYLE.textMuted,
            margin: [20, 0, 0, 0],
          },
          {
            text: `${_currentPage} / ${_pageCount}`,
            fontSize: FOOTER_SIZE,
            color: STYLE.textMuted,
            alignment: "right",
            margin: [0, 0, 20, 0],
          },
        ],
      }) as Content,

    defaultStyle: {
      font: "Roboto",
      fontSize: BODY_SIZE,
      color: STYLE.text,
    },

    content,
  };

  return docDef;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface WorksheetPdfResult {
  buffer: Buffer;
  docDef: TDocumentDefinitions;
}

/**
 * Generates the Hoja de Trabajo as a PDF Buffer (A4 landscape, single page).
 *
 * Returns both the Buffer and the docDef for testing/inspection.
 *
 * @param report   The computed WorksheetReport with Decimal columns
 * @param orgName  Organization display name for the document header
 */
export async function exportWorksheetPdf(
  report: WorksheetReport,
  orgName: string,
): Promise<WorksheetPdfResult> {
  registerFonts();
  const docDef = buildDocDefinition(report, orgName);
  const buffer = await pdfmakeRuntime.createPdf(docDef).getBuffer();
  return { buffer: Buffer.from(buffer), docDef };
}
