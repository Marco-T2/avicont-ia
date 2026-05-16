/**
 * TECH DEBT — REQ-010 cross-module-INFRA dep.
 *
 * This file imports `registerFonts` + `pdfmakeRuntime` (font binary registration,
 * pdfmake runtime wrapper) and `fmtDecimal` (Bolivian decimal formatter) from
 * the SISTER hex module `modules/accounting/financial-statements/infrastructure/exporters/`.
 *
 * Tolerated transitional shape per proposal #2286 D7 Option A. Consolidation
 * deferred to **sub-POC 6 (poc-accounting-exporters-cleanup)** which will extract
 * shared pdf utilities (likely `modules/accounting/shared/infrastructure/exporters/`
 * or `modules/shared/exporters/`) consumable by both FS and TB.
 *
 * **Boundary rule (REQ-010 sentinel)**: this file MAY import from
 * `@/modules/accounting/financial-statements/infrastructure/exporters/{pdf.fonts,pdf.helpers}`
 * ONLY. ANY other `@/modules/accounting/financial-statements/*` import here
 * MUST FAIL the C2/D1 sentinel grep. Cross-module-INFRA tolerance is narrow
 * and scoped; cross-module DOMAIN→PRESENTATION (the sumDecimals/eq case) is
 * NOT tolerated — see domain/money.utils.ts §5 + REQ-009.
 */

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
import { registerFonts, pdfmakeRuntime } from "@/modules/accounting/shared/infrastructure/exporters/pdf.fonts";
import { fmtDecimal } from "@/modules/accounting/shared/infrastructure/exporters/pdf.helpers";
import { buildExecutivePdfHeader } from "@/modules/accounting/shared/infrastructure/exporters/executive-pdf-header";
import { formatDateBO } from "@/lib/date-utils";
import type { TrialBalanceReport, TrialBalanceTotals, TrialBalanceRow } from "../../domain/trial-balance.types";

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

const BODY_SIZE = 8;            // filas de datos y header de columnas
const TITLE_SIZE = 18;          // BALANCE DE COMPROBACIÓN... — paridad con balance-sheet
const SUBTITLE_SIZE = 10;       // "Del X al Y" + "(Expresado en Bolivianos)"
const ORG_INFO_SIZE = 8;        // Empresa/NIT/Dirección/Ciudad — izquierda, chico

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
    fontSize: BODY_SIZE,
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
  // §13.accounting.calendar-day-T12-utc-unified — formatDateBO is pure
  // ISO-slice, TZ-safe by construction (no Intl/locale call).
  return formatDateBO(d);
}

// ── Doc definition builder ────────────────────────────────────────────────────

function buildDocDefinition(
  report: TrialBalanceReport,
  orgName: string,
  orgNit?: string,
  orgAddress?: string,
  orgCity?: string,
): TDocumentDefinitions {
  const tableBody = buildTableBody(report);

  // Header ejecutivo compartido (Empresa/NIT/Dir/Ciudad izquierda 8pt +
  // título centrado 18pt + período + Expresado en Bolivianos)
  const headerContent = buildExecutivePdfHeader({
    orgName,
    orgNit,
    orgAddress,
    orgCity,
    title: "Balance de Comprobación de Sumas y Saldos",
    subtitle: `Del ${fmtDate(report.dateFrom)} al ${fmtDate(report.dateTo)}`,
    titleFontSize: TITLE_SIZE,
    subtitleFontSize: SUBTITLE_SIZE,
    orgInfoFontSize: ORG_INFO_SIZE,
    orgInfoAlignment: "left",
  });

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

interface TrialBalancePdfResult {
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
 * @param orgAddress Physical address — sin ciudad (optional)
 * @param orgCity    Ciudad — se renderiza en línea propia debajo de Dirección (optional)
 */
export async function exportTrialBalancePdf(
  report: TrialBalanceReport,
  orgName: string,
  orgNit?: string,
  orgAddress?: string,
  orgCity?: string,
): Promise<TrialBalancePdfResult> {
  if (!orgName) throw new MissingOrgNameError();

  registerFonts();
  const docDef = buildDocDefinition(report, orgName, orgNit, orgAddress, orgCity);
  const buffer = await pdfmakeRuntime.createPdf(docDef).getBuffer();
  return { buffer: Buffer.from(buffer), docDef };
}
