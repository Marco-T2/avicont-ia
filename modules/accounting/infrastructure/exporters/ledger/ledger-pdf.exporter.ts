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

// Column widths: TODAS fijas en pt (NO usar "*") — paridad con
// voucher-pdf.exporter.ts: "para que pdfmake NO expanda la descripción
// cuando es larga, fuerza wrap estricto dentro del ancho".
// A4 portrait = 595pt − margins (30 + 30) = 535pt disponibles.
// [Fecha=50, Tipo=35, Nº=65, Descripción=195, Debe=60, Haber=60, Saldo=70] → 535.
const COL_WIDTHS: (number | string)[] = [50, 35, 65, 195, 60, 60, 70];

const BODY_SIZE = 9;        // paridad voucher — 10pt era muy apretado horizontal
const TITLE_SIZE = 18;      // portrait — paridad con trial-balance
const SUBTITLE_SIZE = 10;
const ORG_INFO_SIZE = 8;

// ── Cell helpers ──────────────────────────────────────────────────────────────
//
// Cell margin = [left, top, right, bottom]. Aire horizontal generoso (4pt) para
// separar el texto del borde de columna; vertical apretado (0) porque el layout
// aporta padding 2pt arriba/abajo, total 4pt vertical por celda.

function numCell(text: string, bold: boolean): Content {
  return {
    text,
    fontSize: BODY_SIZE,
    bold,
    alignment: "right",
    margin: [4, 0, 4, 0],
  } as Content;
}

function labelCell(text: string, bold: boolean, alignment: "left" | "center" = "left"): Content {
  return {
    text,
    fontSize: BODY_SIZE,
    bold,
    alignment,
    margin: [4, 0, 4, 0],
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
    margin: [4, 0, 4, 0],
  } as Content;
}

function headerCell(text: string): Content {
  return {
    text,
    fontSize: BODY_SIZE,
    bold: true,
    alignment: "center",
    margin: [4, 2, 4, 2],
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
  /**
   * Logo de la organización como data URL base64 (resultado de
   * `fetchLogoAsDataUrl`). Si está presente, se renderiza al lado derecho
   * del bloque de identidad organizacional del header (paridad voucher-pdf).
   * Tolerante: undefined → header sin logo.
   */
  logoDataUrl?: string;
}

function buildExecutiveHeaderWithLogo(
  orgName: string,
  orgNit: string | undefined,
  orgAddress: string | undefined,
  orgCity: string | undefined,
  logoDataUrl: string | undefined,
  opts: LedgerPdfOptions,
): Content[] {
  // Bloque izq: identidad organizacional (membrete) alineado a la izquierda.
  const orgLines: Content[] = [
    {
      text: `Empresa: ${orgName}`,
      fontSize: ORG_INFO_SIZE,
      bold: true,
      alignment: "left",
      margin: [0, 0, 0, 1],
    },
  ];
  if (orgNit && orgNit.trim().length > 0) {
    orgLines.push({
      text: `NIT: ${orgNit}`,
      fontSize: ORG_INFO_SIZE,
      alignment: "left",
      margin: [0, 0, 0, 1],
    });
  }
  if (orgAddress && orgAddress.trim().length > 0) {
    orgLines.push({
      text: `Dirección: ${orgAddress}`,
      fontSize: ORG_INFO_SIZE,
      alignment: "left",
      margin: [0, 0, 0, 1],
    });
  }
  if (orgCity && orgCity.trim().length > 0) {
    orgLines.push({
      text: orgCity,
      fontSize: ORG_INFO_SIZE,
      alignment: "left",
      margin: [0, 0, 0, 1],
    });
  }

  // Bloque der: logo (si hay) right-aligned. Sin logo → placeholder vacío
  // para preservar el layout de 2 columnas y mantener la altura coherente.
  const logoStack: Content[] = [];
  if (logoDataUrl) {
    logoStack.push({
      image: logoDataUrl,
      width: 55,
      alignment: "right",
    });
  } else {
    logoStack.push({ text: " " });
  }

  return [
    {
      columns: [
        { width: "*", stack: orgLines },
        { width: 80, stack: logoStack },
      ],
      margin: [0, 0, 0, 4],
    },
    {
      text: "LIBRO MAYOR",
      fontSize: TITLE_SIZE,
      bold: true,
      alignment: "center",
      margin: [0, 2, 0, 2],
    },
    {
      text: `Cuenta: ${opts.accountCode} — ${opts.accountName}`,
      fontSize: SUBTITLE_SIZE,
      alignment: "center",
      margin: [0, 0, 0, 1],
    },
    {
      text: `Del ${fmtDate(opts.dateFrom)} al ${fmtDate(opts.dateTo)}`,
      fontSize: SUBTITLE_SIZE,
      alignment: "center",
      margin: [0, 0, 0, 1],
    },
    {
      text: "(Expresado en Bolivianos)",
      fontSize: SUBTITLE_SIZE,
      italics: true,
      alignment: "center",
      margin: [0, 0, 0, 6],
    },
  ];
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

  const headerContent = buildExecutiveHeaderWithLogo(
    orgName,
    orgNit,
    orgAddress,
    orgCity,
    opts.logoDataUrl,
    opts,
  );

  const content: Content[] = [
    ...headerContent,
    {
      table: {
        widths: COL_WIDTHS,
        body: tableBody,
        headerRows: 1,
        dontBreakRows: true,
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
        paddingTop: () => 2,
        paddingBottom: () => 2,
      },
    } as Content,
  ];

  // Header compacto para páginas 2+ — mantiene contexto al imprimir hojas
  // sueltas o al hojear un PDF largo. La página 1 conserva el membrete
  // completo en `content` (no se duplica). Texto truncable con clip si
  // accountName es muy largo — la fontSize 8 deja ~120 caracteres por línea.
  const continuationHeader =
    `Libro Mayor — ${opts.accountCode} ${opts.accountName} — ` +
    `Del ${fmtDate(opts.dateFrom)} al ${fmtDate(opts.dateTo)} — ${orgName}`;

  // Generado: timestamp es-BO con TZ La_Paz. Computado UNA vez al generar el
  // PDF y referenciado por el footer en todas las páginas (consistente entre
  // hojas). Paridad con balance-sheet (financial-statements/pdf.exporter.ts).
  const generatedAt = new Date().toLocaleString("es-BO", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return {
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [30, 25, 30, 35],
    defaultStyle: {
      font: "Roboto",
      fontSize: BODY_SIZE,
      color: STYLE.text,
    },
    header: (currentPage: number): Content | null => {
      if (currentPage === 1) return null;
      return {
        text: continuationHeader,
        fontSize: 8,
        alignment: "center",
        color: STYLE.textMuted,
        margin: [30, 10, 30, 0],
      };
    },
    footer: (currentPage: number, pageCount: number): Content => ({
      columns: [
        {
          text: `Generado: ${generatedAt}`,
          fontSize: 8,
          color: STYLE.textMuted,
          margin: [30, 0, 0, 0],
        },
        {
          text: `Página ${currentPage} de ${pageCount}`,
          fontSize: 8,
          color: STYLE.textMuted,
          alignment: "right",
          margin: [0, 0, 30, 0],
        },
      ],
    }),
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
