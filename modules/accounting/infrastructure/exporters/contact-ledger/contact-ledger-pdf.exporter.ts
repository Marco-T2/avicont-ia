/**
 * PDF exporter for Libro Mayor por Contacto (CxC / CxP).
 *
 * Layout: A4 portrait, 8 columnas (Fecha | Tipo | Nº | Estado | Descripción |
 * Debe | Haber | Saldo). Diferencia clave vs sister `ledger-pdf.exporter.ts`
 * (7 cols): adiciona columna `Estado` derivada del status del documento
 * (Pagado/Parcial/Pendiente/ATRASADO/Sin auxiliar/—).
 *
 * Header membrete: Empresa + NIT + Dirección + Ciudad (izq 8pt) + título
 * "LIBRO MAYOR POR CONTACTO" + subtítulo "Contacto: {contactName}" +
 * período + "(Expresado en Bolivianos)".
 *
 * Tabla plana — paridad sister ledger. NO staircase, NO imbalance banner,
 * NO watermark.
 *
 * Opening balance: si `opts.openingBalance !== "0.00"`, primera fila bold
 * "Saldo inicial acumulado" en columna Descripción.
 *
 * Sister precedent (clone-adapt) per [[paired_sister_default_no_surface]]:
 *   modules/accounting/infrastructure/exporters/ledger/ledger-pdf.exporter.ts
 *
 * Subdir `contact-ledger/` per design D6 + [[named_rule_immutability]] —
 * preserva α17 sentinel inmutable (5 archivos top-level del C3 voucher bundle).
 */

import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";
import Decimal from "decimal.js";
import {
  registerFonts,
  pdfmakeRuntime,
} from "@/modules/accounting/shared/infrastructure/exporters/pdf.fonts";
import { fmtDecimal } from "@/modules/accounting/shared/infrastructure/exporters/pdf.helpers";
import { formatDateBO } from "@/lib/date-utils";
import type { ContactLedgerEntry } from "@/modules/accounting/presentation/dto/ledger.types";

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

// Column widths: TODAS fijas en pt (NO usar "*") — paridad sister ledger.
// A4 portrait = 595pt − margins (30 + 30) = 535pt disponibles.
// 8 columnas vs 7 del sister; redistribuyo descripción (-50pt) para meter
// Estado=50pt. Resto idéntico al sister.
// [Fecha=50, Tipo=70, Nº=55, Estado=50, Descripción=120, Debe=60, Haber=60, Saldo=70] = 535.
const COL_WIDTHS: number[] = [50, 70, 55, 50, 120, 60, 60, 70];

const BODY_SIZE = 9;
const TITLE_SIZE = 16;
const SUBTITLE_SIZE = 10;
const ORG_INFO_SIZE = 8;

// ── Cell helpers ──────────────────────────────────────────────────────────────

function numCell(text: string, bold: boolean): Content {
  return {
    text,
    fontSize: BODY_SIZE,
    bold,
    alignment: "right",
    margin: [4, 0, 4, 0],
  } as Content;
}

function labelCell(
  text: string,
  bold: boolean,
  alignment: "left" | "center" = "left",
): Content {
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

// ── Decimal coercion ──────────────────────────────────────────────────────────
//
// ContactLedgerEntry.{debit,credit,balance} y opts.openingBalance llegan
// serializados como `string` desde el service (DEC-1). decimal.js Decimal
// acepta strings.

function toDecimal(s: string): Decimal {
  return new Decimal(s);
}

// ── Tipo cell derivation ──────────────────────────────────────────────────────
//
// Spec REQ "Type Column":
//   SALE → voucherTypeHuman (e.g. "Nota de despacho", "Factura") fallback "Venta"
//   PURCHASE → voucherTypeHuman fallback "Compra"
//   RECEIPT → "Cobranza (<paymentMethod humanizado>)"
//   PAYMENT → "Pago (<paymentMethod humanizado>)"
//   MANUAL (sourceType=null) → "Ajuste"
//
// Mirror exact precedent UI `contact-ledger-page-client.tsx` renderTipo()
// per [[paired_sister_default_no_surface]] — humanización idéntica.

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
  // DT — código operacional físico (Marco QA): el cobrador necesita ver
  // VG/RC/ND/BC/FL/PF/CG/SV en lugar del label genérico.
  //
  // Orden de prioridad mirror UI page-client per
  // [[paired_sister_default_no_surface]]:
  //   1. withoutAuxiliary → "Ajuste".
  //   2. documentTypeCode + payment → "${code} (${formaPago})".
  //   3. documentTypeCode plano → code.
  //   4. Fallback legacy cuando documentTypeCode=null.

  if (entry.withoutAuxiliary) {
    return "Ajuste";
  }

  const src = entry.sourceType?.toLowerCase() ?? null;
  const code = entry.documentTypeCode;

  if (code) {
    if (src === "payment" || src === "receipt") {
      const pm = humanPaymentMethod(entry.paymentMethod, entry.bankAccountName);
      return pm ? `${code} (${pm})` : code;
    }
    return code;
  }

  // BF3 fallback — direction-aware cuando NO hay documentTypeCode.
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
//
// Spec REQ "Status Column":
//   - PAID → "Pagado"
//   - PARTIAL → "Parcial"
//   - PENDING → "Pendiente" (unless dueDate < hoy → "ATRASADO" runtime)
//   - VOIDED / CANCELLED → "Anulado"
//   - withoutAuxiliary=true → "Sin auxiliar"
//   - null (RECEIPT/PAYMENT) → "—"

function renderEstado(entry: ContactLedgerEntry): string {
  if (entry.withoutAuxiliary) return "Sin auxiliar";
  const status = entry.status;
  if (status == null) return "—";

  // ATRASADO derivado runtime.
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

// ── Row cells builders ────────────────────────────────────────────────────────

function buildOpeningRowCells(openingBalance: string): Content[] {
  return [
    labelCell("—", true, "center"),
    labelCell("—", true, "center"),
    labelCell("—", true, "center"),
    labelCell("—", true, "center"),
    italicLabelCell("Saldo inicial acumulado", true),
    numCell("", true),
    numCell("", true),
    numCell(fmtDecimal(toDecimal(openingBalance), true), true),
  ];
}

function buildDataRowCells(entry: ContactLedgerEntry): Content[] {
  return [
    labelCell(formatDateBO(entry.date as unknown as string), false),
    labelCell(renderTipo(entry), false),
    // DT4 — render número físico del documento ("VG-0001", "RC-0042") con
    // fallback al displayNumber correlative voucher cuando el documento no
    // resuelve (asiento manual sin auxiliar / Payment sin referenceNumber).
    labelCell(entry.documentReferenceNumber ?? entry.displayNumber, false),
    labelCell(renderEstado(entry), false, "center"),
    labelCell(entry.description, false),
    numCell(fmtDecimal(toDecimal(entry.debit), false), false),
    numCell(fmtDecimal(toDecimal(entry.credit), false), false),
    numCell(fmtDecimal(toDecimal(entry.balance), false), false),
  ];
}

// ── Table body ────────────────────────────────────────────────────────────────

interface BuildTableOpts {
  entries: ContactLedgerEntry[];
  openingBalance: string;
}

function buildTableBody({
  entries,
  openingBalance,
}: BuildTableOpts): Content[][] {
  const rows: Content[][] = [];

  rows.push([
    headerCell("Fecha"),
    headerCell("Tipo"),
    headerCell("Nº"),
    headerCell("Estado"),
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
  return formatDateBO(d);
}

// ── Doc definition builder ────────────────────────────────────────────────────

export interface ContactLedgerPdfOptions {
  contactName: string;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string; // YYYY-MM-DD
  openingBalance: string;
  /**
   * Logo de la organización como data URL base64 (resultado de
   * `fetchLogoAsDataUrl`). Si está presente, se renderiza al lado derecho
   * del bloque de identidad organizacional del header (paridad sister).
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
  opts: ContactLedgerPdfOptions,
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

  // Bloque der: logo (si hay) right-aligned. Sin logo → placeholder vacío.
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
      text: "LIBRO MAYOR POR CONTACTO",
      fontSize: TITLE_SIZE,
      bold: true,
      alignment: "center",
      margin: [0, 2, 0, 2],
    },
    {
      text: `Contacto: ${opts.contactName}`,
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
  entries: ContactLedgerEntry[],
  opts: ContactLedgerPdfOptions,
  orgName: string,
  orgNit?: string,
  orgAddress?: string,
  orgCity?: string,
): TDocumentDefinitions {
  const tableBody = buildTableBody({
    entries,
    openingBalance: opts.openingBalance,
  });

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

  // Header compacto pg 2+ — paridad sister.
  const continuationHeader =
    `Libro Mayor — ${opts.contactName} — ` +
    `Del ${fmtDate(opts.dateFrom)} al ${fmtDate(opts.dateTo)} — ${orgName}`;

  // Generado: timestamp es-BO TZ La_Paz, computado una vez.
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

interface ContactLedgerPdfResult {
  buffer: Buffer;
  docDef: TDocumentDefinitions;
}

/**
 * Genera el Libro Mayor por Contacto como PDF Buffer (A4 portrait, 8 cols).
 *
 * Returns both el Buffer y el docDef para testing/inspection (paridad sister).
 *
 * @param entries    ContactLedgerEntry[] — el reporte completo (NO paginado).
 *                   El route handler debe llamar `getContactLedgerPaginated`
 *                   con pageSize gigante para obtener TODAS las filas + el
 *                   openingBalance acumulado del historial previo al rango.
 * @param opts       Cabecera + opening balance:
 *                     - contactName → renderiza en subtítulo.
 *                     - dateFrom / dateTo (YYYY-MM-DD) → renderizan en período.
 *                     - openingBalance (string serializado) → si !== "0.00",
 *                       primera fila decorativa.
 *                     - logoDataUrl (optional) → image en col der del header.
 * @param orgName    Organization display name (required — throws MissingOrgNameError si falsy).
 * @param orgNit     NIT/tax-id (optional).
 * @param orgAddress Dirección sin ciudad (optional).
 * @param orgCity    Ciudad — línea propia debajo de Dirección (optional).
 */
export async function exportContactLedgerPdf(
  entries: ContactLedgerEntry[],
  opts: ContactLedgerPdfOptions,
  orgName: string,
  orgNit?: string,
  orgAddress?: string,
  orgCity?: string,
): Promise<ContactLedgerPdfResult> {
  if (!orgName) throw new MissingOrgNameError();

  registerFonts();
  const docDef = buildDocDefinition(
    entries,
    opts,
    orgName,
    orgNit,
    orgAddress,
    orgCity,
  );
  const buffer = await pdfmakeRuntime.createPdf(docDef).getBuffer();
  return { buffer: Buffer.from(buffer), docDef };
}
