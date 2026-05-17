/**
 * PDF exporter for Libro Mayor (cuenta + período).
 *
 * Layout: A4 portrait, 7 columns (Fecha | Tipo | Nº | Descripción | Debe |
 * Haber | Saldo). Header membrete: Empresa + NIT + Dirección + Ciudad (izq
 * 8pt) + título + subtítulo (Cuenta + período) + "(Expresado en Bolivianos)".
 *
 * Tabla plana — NO staircase, NO imbalance banner, NO watermark PRELIMINAR
 * (regla §8 del mapa de patrones contables: el libro mayor es plano por
 * naturaleza, sin jerarquía sección→subgrupo→cuenta).
 *
 * Opening balance: si `opts.openingBalance !== "0.00"`, primera fila bold
 * "Saldo inicial acumulado" con el saldo en columna Saldo (paridad con la
 * fila decorativa de la UI — `components/accounting/ledger-page-client.tsx`).
 *
 * Sister precedent: `modules/accounting/trial-balance/infrastructure/
 * exporters/trial-balance-pdf.exporter.ts`.
 */

import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";
import Decimal from "decimal.js";
import { registerFonts, pdfmakeRuntime } from "@/modules/accounting/shared/infrastructure/exporters/pdf.fonts";
import { fmtDecimal } from "@/modules/accounting/shared/infrastructure/exporters/pdf.helpers";
import { buildExecutivePdfHeader } from "@/modules/accounting/shared/infrastructure/exporters/executive-pdf-header";
import { formatDateBO } from "@/lib/date-utils";
import type { LedgerEntry } from "@/modules/accounting/presentation/dto/ledger.types";

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
} as const;

// Column widths: [Fecha=55, Tipo=35, Nº=70, Descripción=*, Debe=70, Haber=70, Saldo=75]
// Suman 375 + "*" → llena los 535pt de A4 portrait (printable: 595 − 60 margins).
const COL_WIDTHS: (number | string)[] = [55, 35, 70, "*", 70, 70, 75];

const BODY_SIZE = 10;       // portrait → 10pt per doc §2
const TITLE_SIZE = 18;      // portrait — paridad con trial-balance
const SUBTITLE_SIZE = 10;
const ORG_INFO_SIZE = 8;

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

function labelCell(text: string, bold: boolean, alignment: "left" | "center" = "left"): Content {
  return {
    text,
    fontSize: BODY_SIZE,
    bold,
    alignment,
    margin: [2, 1, 2, 1],
  } as Content;
}

function italicLabelCell(text: string, bold: boolean): Content {
  return {
    text,
    fontSize: BODY_SIZE,
    bold,
    italics: true,
    alignment: "left",
    color: STYLE.textMuted,
    margin: [2, 1, 2, 1],
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

// ── String→Decimal coercion ───────────────────────────────────────────────────
//
// LedgerEntry.{debit,credit,balance} y opts.openingBalance vienen serializados
// como `string` desde el service (DTO boundary — `roundHalfUp().toFixed(2)`).
// fmtDecimal acepta cualquier DecimalLike; decimal.js Decimal acepta strings.

function toDecimal(s: string): Decimal {
  return new Decimal(s);
}

// ── Row cells builders ────────────────────────────────────────────────────────

function buildOpeningRowCells(openingBalance: string): Content[] {
  return [
    labelCell("—", true, "center"),
    labelCell("—", true, "center"),
    labelCell("—", true, "center"),
    italicLabelCell("Saldo inicial acumulado", true),
    numCell("", true),
    numCell("", true),
    numCell(fmtDecimal(toDecimal(openingBalance), true), true),
  ];
}

function buildDataRowCells(entry: LedgerEntry): Content[] {
  return [
    labelCell(formatDateBO(entry.date), false),
    labelCell(entry.voucherCode, false, "center"),
    labelCell(entry.displayNumber, false),
    labelCell(entry.description, false),
    numCell(fmtDecimal(toDecimal(entry.debit), false), false),
    numCell(fmtDecimal(toDecimal(entry.credit), false), false),
    numCell(fmtDecimal(toDecimal(entry.balance), false), false),
  ];
}

// ── Table body ────────────────────────────────────────────────────────────────

interface BuildTableOpts {
  entries: LedgerEntry[];
  openingBalance: string;
}

function buildTableBody({ entries, openingBalance }: BuildTableOpts): Content[][] {
  const rows: Content[][] = [];

  rows.push([
    headerCell("Fecha"),
    headerCell("Tipo"),
    headerCell("Nº"),
    headerCell("Descripción"),
    headerCell("Debe"),
    headerCell("Haber"),
    headerCell("Saldo"),
  ]);

  if (openingBalance !== "0.00") {
    rows.push(buildOpeningRowCells(openingBalance));
  }

  entries.forEach((entry) => {
    rows.push(buildDataRowCells(entry));
  });

  return rows;
}

// ── Date formatter ────────────────────────────────────────────────────────────

function fmtDate(d: string): string {
  // §13.accounting.calendar-day-T12-utc-unified — formatDateBO es ISO-slice
  // TZ-safe por construcción (no Intl/locale).
  return formatDateBO(d);
}

// ── Doc definition builder ────────────────────────────────────────────────────

export interface LedgerPdfOptions {
  accountCode: string;
  accountName: string;
  dateFrom: string;  // YYYY-MM-DD
  dateTo: string;    // YYYY-MM-DD
  openingBalance: string;
}

function buildDocDefinition(
  entries: LedgerEntry[],
  opts: LedgerPdfOptions,
  orgName: string,
  orgNit?: string,
  orgAddress?: string,
  orgCity?: string,
): TDocumentDefinitions {
  const tableBody = buildTableBody({ entries, openingBalance: opts.openingBalance });

  const subtitle = [
    `Cuenta: ${opts.accountCode} — ${opts.accountName}`,
    `Del ${fmtDate(opts.dateFrom)} al ${fmtDate(opts.dateTo)}`,
  ].join("\n");

  const headerContent = buildExecutivePdfHeader({
    orgName,
    orgNit,
    orgAddress,
    orgCity,
    title: "Libro Mayor",
    subtitle,
    titleFontSize: TITLE_SIZE,
    subtitleFontSize: SUBTITLE_SIZE,
    orgInfoFontSize: ORG_INFO_SIZE,
    orgInfoAlignment: "left",
  });

  const content: Content[] = [
    ...headerContent,
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

interface LedgerPdfResult {
  buffer: Buffer;
  docDef: TDocumentDefinitions;
}

/**
 * Generates the Libro Mayor as a PDF Buffer (A4 portrait).
 *
 * Returns both the Buffer and the docDef for testing/inspection.
 *
 * @param entries    LedgerEntry[] — el reporte completo (NO paginado).
 *                   El route handler debe llamar `getAccountLedger` (no la
 *                   versión paginada), per doc §8 explícito.
 * @param opts       Cabecera + opening balance:
 *                     - accountCode / accountName → renderizan en subtítulo.
 *                     - dateFrom / dateTo (YYYY-MM-DD) → renderizan en período.
 *                     - openingBalance (string serializado) → si !== "0.00",
 *                       primera fila decorativa "Saldo inicial acumulado".
 * @param orgName    Organization display name (required — throws MissingOrgNameError if falsy)
 * @param orgNit     NIT/tax-id (optional)
 * @param orgAddress Dirección sin ciudad (optional)
 * @param orgCity    Ciudad — línea propia debajo de Dirección (optional)
 */
export async function exportLedgerPdf(
  entries: LedgerEntry[],
  opts: LedgerPdfOptions,
  orgName: string,
  orgNit?: string,
  orgAddress?: string,
  orgCity?: string,
): Promise<LedgerPdfResult> {
  if (!orgName) throw new MissingOrgNameError();

  registerFonts();
  const docDef = buildDocDefinition(entries, opts, orgName, orgNit, orgAddress, orgCity);
  const buffer = await pdfmakeRuntime.createPdf(docDef).getBuffer();
  return { buffer: Buffer.from(buffer), docDef };
}
