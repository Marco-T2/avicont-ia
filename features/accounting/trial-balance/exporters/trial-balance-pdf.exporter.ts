/**
 * PDF exporter for Balance de Comprobación de Sumas y Saldos.
 *
 * Layout: A4 portrait, 7 columns, widths [25,55,185,70,70,65,65] summing to 535pt.
 * Header: Empresa, NIT/Dirección, title, period, (Expresado en Bolivianos).
 * Imbalance banner (red bold) above table when report.imbalanced=true.
 * Zero-value convention: detail rows → "", totals → "0,00".
 * es-BO locale: period thousands separator, comma decimal (1.234,56).
 * Negatives: parentheses notation (1.234,56).
 */

import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";
import { registerFonts, pdfmakeRuntime } from "../../financial-statements/exporters/pdf.fonts";
import { fmtDecimal } from "../../financial-statements/exporters/pdf.helpers";
import type { TrialBalanceReport, TrialBalanceTotals, TrialBalanceRow } from "../trial-balance.types";
import { Prisma } from "@/generated/prisma/client";

// ── Error ─────────────────────────────────────────────────────────────────────

export class MissingOrgNameError extends Error {
  constructor() {
    super("orgName is required for PDF export");
    this.name = "MissingOrgNameError";
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STYLE = {
  text: "#000000",
  textMuted: "#6b7280",
  danger: "#b91c1c",
} as const;

// Column widths: [N°=25, Código=55, Cuenta=185, SumasDebe=70, SumasHaber=70, SaldoDeudor=65, SaldoAcreedor=65]
// Sum = 535pt (A4 portrait printable width 595mm − 60pt margins)
const COL_WIDTHS: (number | string)[] = [25, 55, 185, 70, 70, 65, 65];

const BODY_SIZE = 7;
const HEADER_SIZE = 7;
const TITLE_SIZE = 11;
const SUBTITLE_SIZE = 8;

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

function labelCell(text: string, bold: boolean): Content {
  return {
    text,
    fontSize: BODY_SIZE,
    bold,
    alignment: "left",
    margin: [2, 1, 2, 1],
  } as Content;
}

function centerCell(text: string | number, bold: boolean, fontSize = BODY_SIZE): Content {
  return {
    text: String(text),
    fontSize,
    bold,
    alignment: "center",
    margin: [1, 1, 1, 1],
  } as Content;
}

function headerCell(text: string): Content {
  return {
    text,
    fontSize: HEADER_SIZE,
    bold: true,
    alignment: "center",
    margin: [1, 2, 1, 2],
    fillColor: "#f3f4f6",
  } as Content;
}

// ── Row cells builders ────────────────────────────────────────────────────────

function buildDataRowCells(
  rowNumber: number,
  row: TrialBalanceRow,
  bold: boolean,
): Content[] {
  return [
    centerCell(rowNumber, bold),
    labelCell(row.code, bold),
    labelCell(row.name, bold),
    numCell(fmtDecimal(row.sumasDebe, false), bold),
    numCell(fmtDecimal(row.sumasHaber, false), bold),
    numCell(fmtDecimal(row.saldoDeudor, false), bold),
    numCell(fmtDecimal(row.saldoAcreedor, false), bold),
  ];
}

function buildTotalRowCells(totals: TrialBalanceTotals): Content[] {
  return [
    centerCell("", true),
    labelCell("", true),
    { text: "TOTAL", fontSize: BODY_SIZE, bold: true, alignment: "left", colSpan: 1, margin: [2, 1, 2, 1] } as Content,
    numCell(fmtDecimal(totals.sumasDebe, true), true),
    numCell(fmtDecimal(totals.sumasHaber, true), true),
    numCell(fmtDecimal(totals.saldoDeudor, true), true),
    numCell(fmtDecimal(totals.saldoAcreedor, true), true),
  ];
}

// ── Table body ────────────────────────────────────────────────────────────────

function buildTableBody(report: TrialBalanceReport): Content[][] {
  const rows: Content[][] = [];

  // Header row
  rows.push([
    headerCell("N°"),
    headerCell("Código"),
    headerCell("Cuenta"),
    headerCell("Sumas Debe"),
    headerCell("Sumas Haber"),
    headerCell("Saldo Deudor"),
    headerCell("Saldo Acreedor"),
  ]);

  // Data rows
  report.rows.forEach((row, idx) => {
    rows.push(buildDataRowCells(idx + 1, row, false));
  });

  // Total row (bold, top border)
  const totalCells = buildTotalRowCells(report.totals);
  rows.push(totalCells);

  return rows;
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

// ── Doc definition builder ────────────────────────────────────────────────────

function buildDocDefinition(
  report: TrialBalanceReport,
  orgName: string,
  orgNit?: string,
  orgAddress?: string,
): TDocumentDefinitions {
  const tableBody = buildTableBody(report);

  // Build header lines
  const headerContent: Content[] = [];

  // Line 1: Empresa
  headerContent.push({
    text: `Empresa: ${orgName}`,
    fontSize: SUBTITLE_SIZE,
    bold: true,
    alignment: "center",
    margin: [0, 0, 0, 2],
  } as Content);

  // Line 2: NIT + Dirección (graceful omission)
  const nitPart = orgNit ? `NIT: ${orgNit}` : null;
  const addrPart = orgAddress ? `Dirección: ${orgAddress}` : null;
  const line2Parts = [nitPart, addrPart].filter(Boolean);
  if (line2Parts.length > 0) {
    headerContent.push({
      text: line2Parts.join(" · "),
      fontSize: SUBTITLE_SIZE,
      alignment: "center",
      margin: [0, 0, 0, 2],
    } as Content);
  }

  // Line 3: Title
  headerContent.push({
    text: "BALANCE DE COMPROBACIÓN DE SUMAS Y SALDOS",
    fontSize: TITLE_SIZE,
    bold: true,
    alignment: "center",
    margin: [0, 2, 0, 2],
  } as Content);

  // Line 4: Period
  headerContent.push({
    text: `DEL ${fmtDate(report.dateFrom)} AL ${fmtDate(report.dateTo)}`,
    fontSize: SUBTITLE_SIZE,
    alignment: "center",
    margin: [0, 0, 0, 2],
  } as Content);

  // Line 5: Expresado en
  headerContent.push({
    text: "(Expresado en Bolivianos)",
    fontSize: SUBTITLE_SIZE,
    italics: true,
    alignment: "center",
    margin: [0, 0, 0, 6],
  } as Content);

  // Imbalance banner
  const imbalanceBanner: Content[] = report.imbalanced
    ? [
        {
          text: [
            `Balance desbalanceado — Delta Sumas: ${fmtDecimal(report.deltaSumas, true)} · `,
            `Delta Saldos: ${fmtDecimal(report.deltaSaldos, true)}`,
          ].join(""),
          fontSize: BODY_SIZE,
          color: STYLE.danger,
          bold: true,
          margin: [0, 0, 0, 4],
        } as Content,
      ]
    : [];

  const content: Content[] = [
    ...headerContent,
    ...imbalanceBanner,
    {
      table: {
        widths: COL_WIDTHS,
        body: tableBody,
        headerRows: 1,
        dontBreakRows: false,
      },
      layout: {
        hLineWidth: (i: number, node: { table: { body: unknown[] } }) => {
          if (i === 0 || i === 1) return 0.5;
          if (i === node.table.body.length) return 0.5;
          // Top border on total row (last body row)
          if (i === node.table.body.length - 1) return 0.5;
          return 0;
        },
        vLineWidth: () => 0,
        hLineColor: () => "#000000",
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 1,
        paddingBottom: () => 1,
      },
    } as Content,
  ];

  return {
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [30, 50, 30, 40],
    defaultStyle: {
      font: "Roboto",
      fontSize: BODY_SIZE,
      color: STYLE.text,
    },
    content,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface TrialBalancePdfResult {
  buffer: Buffer;
  docDef: TDocumentDefinitions;
}

/**
 * Generates the Balance de Sumas y Saldos as a PDF Buffer (A4 portrait).
 *
 * Returns both the Buffer and the docDef for testing/inspection.
 *
 * @param report     The computed TrialBalanceReport
 * @param orgName    Organization display name (required — throws MissingOrgNameError if falsy)
 * @param orgNit     NIT/tax-id (optional)
 * @param orgAddress Physical address (optional)
 */
export async function exportTrialBalancePdf(
  report: TrialBalanceReport,
  orgName: string,
  orgNit?: string,
  orgAddress?: string,
): Promise<TrialBalancePdfResult> {
  if (!orgName) throw new MissingOrgNameError();

  registerFonts();
  const docDef = buildDocDefinition(report, orgName, orgNit, orgAddress);
  const buffer = await pdfmakeRuntime.createPdf(docDef).getBuffer();
  return { buffer: Buffer.from(buffer), docDef };
}
