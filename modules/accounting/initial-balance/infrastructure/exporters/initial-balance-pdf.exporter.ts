/**
 * PDF exporter for the Balance Inicial report.
 *
 * Layout: legal Bolivian header (razón social bold italic, NIT, dirección,
 * representante legal — left aligned) + staircase BCB body + firma del
 * representante legal al pie. Match al patrón del balance-sheet en el cuerpo
 * (3 columnas escalonadas + tipografía espaciada en grand-totals + línea
 * sólo bajo el número) pero conserva el formato legal (firmas) que el
 * documento de apertura requiere.
 *
 * Reuses shared helpers: `spaceLetters` + `wrapWithTopBorder` desde
 * `@/modules/accounting/shared/infrastructure/exporters/pdf-staircase`.
 *
 * **REQ-010 RESOLVED (shared INFRA)**: importa `registerFonts` y `pdfmakeRuntime`
 * desde `@/modules/accounting/shared/infrastructure/exporters/pdf.fonts` y
 * `fmtDecimal` desde `pdf.helpers`. REQ-010 sentinel α44 asserts el shared path.
 */
import type { TDocumentDefinitions } from "pdfmake/interfaces";
import { registerFonts, pdfmakeRuntime } from "@/modules/accounting/shared/infrastructure/exporters/pdf.fonts";
import { fmtDecimal } from "@/modules/accounting/shared/infrastructure/exporters/pdf.helpers";
import { spaceLetters, wrapWithTopBorder } from "@/modules/accounting/shared/infrastructure/exporters/pdf-staircase";
import { formatDateBO } from "@/lib/date-utils";
import type { InitialBalanceStatement, InitialBalanceGroup } from "../../domain/initial-balance.types";

// ── Public types ──────────────────────────────────────────────────────────────

interface InitialBalancePdfResult {
  buffer: Buffer;
  docDef: TDocumentDefinitions;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BODY_SIZE = 10;            // detalle de cuentas + saldos (match balance-sheet)
const SECTION_SIZE = 11;         // ACTIVO / PASIVO Y PATRIMONIO (header de sección)
const RAZONSOCIAL_SIZE = 12;     // razón social bold italic
const HEADER_SIZE = 8;           // NIT, dirección, ciudad, representante legal
const TITLE_SIZE = 18;           // BALANCE INICIAL (centrado, grande)
const SUBTITLE_SIZE = 10;        // Al {fecha}, (Expresado en Bolivianos)
const FOOTER_SIZE = 8;

// Anchos de columna del cuerpo staircase: [nombre*, detalle, subtotal, total]
const COL_WIDTHS = ["*", 80, 80, 110] as const;

const STYLE = {
  text: "#000000",
  danger: "#b91c1c",
  muted: "#6b7280",
} as const;

function fmtDateLong(d: Date): string {
  // §13.accounting.calendar-day-T12-utc-unified — TZ-safe ISO-slice.
  return formatDateBO(d);
}

// ── Cell helpers ──────────────────────────────────────────────────────────────

type Content = Record<string, unknown>;

function textCell(text: string, opts: {
  bold?: boolean;
  fontSize?: number;
  alignment?: string;
  color?: string;
  margin?: number[];
  italics?: boolean;
  colSpan?: number;
}): Content {
  const cell: Content = {
    text,
    fontSize: opts.fontSize ?? BODY_SIZE,
    bold: opts.bold ?? false,
    alignment: opts.alignment ?? "left",
    margin: opts.margin ?? [2, 1, 2, 1],
  };
  if (opts.color) cell.color = opts.color;
  if (opts.italics) cell.italics = true;
  if (opts.colSpan) cell.colSpan = opts.colSpan;
  return cell;
}

function emptyCell(): Content {
  return { text: "" };
}

/**
 * Construye una celda de saldo derecha-alineada. Si `borderTop=true`, envuelve
 * la celda en una nested table que dibuja una línea horizontal SÓLO bajo esta
 * columna (estilo BCB — la línea no se extiende a lo largo de toda la fila).
 */
function saldoCell(
  value: string,
  opts: { bold?: boolean; fontSize?: number; borderTop?: boolean },
): Content {
  const inner: Content = {
    text: value,
    bold: opts.bold === true,
    fontSize: opts.fontSize ?? BODY_SIZE,
    color: STYLE.text,
    alignment: "right",
    margin: [2, opts.borderTop ? 3 : 2, 4, 2],
  };
  return opts.borderTop ? (wrapWithTopBorder(inner) as unknown as Content) : inner;
}

// ── Section / group row builders (staircase) ──────────────────────────────────

/**
 * Construye filas pdfmake para un grupo del balance inicial:
 *   - 1 fila header del subtype con SUBTOTAL absorbido al lado (col subtotal)
 *   - N filas de detalle con CÓDIGO + NOMBRE en MAYÚS y saldo en col detalle
 *
 * Se omite la fila "Total {subtype}" — su saldo va en el header del grupo
 * (estilo BCB).
 */
function buildGroupRows(group: InitialBalanceGroup): Content[][] {
  const rows: Content[][] = [];
  const subtotalStr = fmtDecimal(group.subtotal, true);

  // Header del subtype con subtotal en col 2 (subtotal column)
  rows.push([
    textCell(group.label.toUpperCase(), {
      bold: true,
      fontSize: BODY_SIZE,
      margin: [8, 3, 2, 3],
    }),
    emptyCell(),
    saldoCell(subtotalStr, { bold: true }),
    emptyCell(),
  ]);

  // Filas de detalle (skip cuentas con amount=0)
  for (const row of group.rows) {
    if (row.amount.isZero()) continue;
    rows.push([
      textCell(`${row.code}  ${row.name.toUpperCase()}`, {
        margin: [20, 0, 2, 0],
      }),
      saldoCell(fmtDecimal(row.amount, false), {}),
      emptyCell(),
      emptyCell(),
    ]);
  }

  return rows;
}

// ── Doc definition ────────────────────────────────────────────────────────────

function buildDocDefinition(statement: InitialBalanceStatement): TDocumentDefinitions {
  const { org, dateAt, sections, imbalanced, imbalanceDelta, multipleCA } = statement;
  const [activoSection, pasivoSection] = sections;
  const fechaLarga = fmtDateLong(dateAt);

  // ── Header legal — LEFT aligned, formato boliviano ─────────────────────────
  const headerContent: Content[] = [
    textCell(org.razonSocial, {
      bold: true,
      italics: true,
      fontSize: RAZONSOCIAL_SIZE,
      alignment: "left",
      margin: [0, 0, 0, 2],
    }),
    textCell(`De: ${org.representanteLegal}`, {
      fontSize: HEADER_SIZE,
      alignment: "left",
      margin: [0, 0, 0, 2],
    }),
    textCell(`NIT: ${org.nit}`, {
      fontSize: HEADER_SIZE,
      alignment: "left",
      margin: [0, 0, 0, 2],
    }),
    textCell(org.direccion, {
      fontSize: HEADER_SIZE,
      alignment: "left",
      margin: [0, 0, 0, 2],
    }),
    textCell(org.ciudad, {
      fontSize: HEADER_SIZE,
      alignment: "left",
      margin: [0, 0, 0, 10],
    }),
    // Título BALANCE INICIAL — centrado, grande
    textCell("BALANCE INICIAL", {
      bold: true,
      fontSize: TITLE_SIZE,
      alignment: "center",
      margin: [0, 6, 0, 4],
    }),
    textCell(`Al ${fechaLarga}`, {
      fontSize: SUBTITLE_SIZE,
      alignment: "center",
      margin: [0, 0, 0, 2],
    }),
    textCell("(Expresado en Bolivianos)", {
      italics: true,
      fontSize: SUBTITLE_SIZE,
      alignment: "center",
      margin: [0, 0, 0, 10],
    }),
  ];

  // ── Banners ────────────────────────────────────────────────────────────────
  const imbalanceBanner: Content[] = imbalanced
    ? [{
        text: `ADVERTENCIA: El balance inicial está desbalanceado — Diferencia: Bs. ${fmtDecimal(imbalanceDelta, true)}`,
        fontSize: BODY_SIZE,
        color: STYLE.danger,
        bold: true,
        margin: [0, 0, 0, 4],
      }]
    : [];

  const multipleCaBanner: Content[] = multipleCA
    ? [{
        text: `AVISO: Se encontraron ${statement.caCount} comprobantes de apertura (CA). Los saldos mostrados son el consolidado de todos los CA contabilizados.`,
        fontSize: BODY_SIZE,
        color: STYLE.muted,
        margin: [0, 0, 0, 4],
      }]
    : [];

  // ── Cuerpo staircase ───────────────────────────────────────────────────────
  // Estructura por sección:
  //   1. Header de sección (ACTIVO / PASIVO Y PATRIMONIO) con sectionTotal en col total
  //   2. Grupos via buildGroupRows (header con subtotal + cuentas)
  //   3. Fila TOTAL letter-spaced con sectionTotal en col total + línea encima
  function buildSectionRows(
    label: string,
    totalLabel: string,
    section: typeof activoSection,
  ): Content[][] {
    const sectionTotalStr = fmtDecimal(section.sectionTotal, true);
    const rows: Content[][] = [];

    // Header de sección — MAYÚS plano (no letter-spaced), bold, con saldo en col total
    rows.push([
      textCell(label, {
        bold: true,
        fontSize: SECTION_SIZE,
        margin: [4, 6, 4, 6],
      }),
      emptyCell(),
      emptyCell(),
      saldoCell(sectionTotalStr, { bold: true, fontSize: SECTION_SIZE }),
    ]);

    // Grupos
    for (const group of section.groups) {
      rows.push(...buildGroupRows(group));
    }

    // Fila TOTAL — letter-spaced, padding generoso, línea encima del saldo
    rows.push([
      textCell(spaceLetters(totalLabel), {
        bold: true,
        fontSize: BODY_SIZE,
        margin: [4, 6, 4, 6],
      }),
      emptyCell(),
      emptyCell(),
      saldoCell(sectionTotalStr, { bold: true, borderTop: true }),
    ]);

    return rows;
  }

  const activoBodyRows = buildSectionRows("ACTIVO", "TOTAL ACTIVO", activoSection);
  const pasivoBodyRows = buildSectionRows(
    "PASIVO Y PATRIMONIO",
    "TOTAL PASIVO Y PATRIMONIO",
    pasivoSection,
  );

  // Layout de tabla sin líneas globales — los bordes se dibujan vía nested table
  // en las celdas de saldo de las filas TOTAL.
  const sectionLayout = {
    hLineWidth: () => 0,
    vLineWidth: () => 0,
    paddingLeft: () => 0,
    paddingRight: () => 0,
    paddingTop: () => 1,
    paddingBottom: () => 1,
  };

  // ── Firmas — ONE signature, representante legal, centered ──────────────────
  const signatureBlock: Content[] = [
    {
      text: `${org.ciudad}, ${fechaLarga}`,
      fontSize: FOOTER_SIZE,
      alignment: "center",
      margin: [0, 16, 0, 0],
    },
    { text: "\n\n\n", fontSize: BODY_SIZE },
    {
      stack: [
        { text: "_______________________________", fontSize: BODY_SIZE, alignment: "center" },
        { text: org.representanteLegal, fontSize: BODY_SIZE, bold: true, alignment: "center" },
        { text: "Representante Legal", fontSize: FOOTER_SIZE - 1, alignment: "center", color: STYLE.muted },
      ],
      margin: [0, 0, 0, 0],
    },
  ];

  const content: Content[] = [
    ...headerContent,
    ...imbalanceBanner,
    ...multipleCaBanner,
    {
      table: {
        widths: COL_WIDTHS,
        body: activoBodyRows,
        dontBreakRows: false,
      },
      layout: sectionLayout,
      margin: [0, 0, 0, 8],
    },
    {
      table: {
        widths: COL_WIDTHS,
        body: pasivoBodyRows,
        dontBreakRows: false,
      },
      layout: sectionLayout,
      margin: [0, 0, 0, 8],
    },
    ...signatureBlock,
  ];

  return {
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [40, 40, 40, 50],
    defaultStyle: { font: "Roboto", fontSize: BODY_SIZE, color: STYLE.text },
    content: content as unknown as import("pdfmake/interfaces").Content[],
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function exportInitialBalancePdf(
  statement: InitialBalanceStatement,
): Promise<InitialBalancePdfResult> {
  registerFonts();
  const docDef = buildDocDefinition(statement);
  const buffer = await pdfmakeRuntime.createPdf(docDef).getBuffer();
  return { buffer: Buffer.from(buffer), docDef };
}
