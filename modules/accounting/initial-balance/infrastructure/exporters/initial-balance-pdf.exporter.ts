/**
 * PDF exporter for the Balance Inicial report.
 *
 * **REQ-010 RESOLVED (shared INFRA)**: this file imports `registerFonts` and
 * `pdfmakeRuntime` from `@/modules/accounting/shared/infrastructure/exporters/pdf.fonts`
 * and `fmtDecimal` from `pdf.helpers`. pdf.fonts.ts + pdf.helpers.ts were
 * git-mv'd from FS-infra to the shared canonical home at
 * poc-accounting-exporters-cleanup (sub-POC 6) — shared font registration has a
 * singleton side-effect, so a single canonical home is required. The cross-module
 * FS-INFRA dependency no longer exists.
 * REQ-010 sentinel α44 asserts the shared path.
 * Sister precedent: WS design #2316 §6, WS archive #2327.
 */
import type { TDocumentDefinitions } from "pdfmake/interfaces";
import { registerFonts, pdfmakeRuntime } from "@/modules/accounting/shared/infrastructure/exporters/pdf.fonts";
import { fmtDecimal } from "@/modules/accounting/shared/infrastructure/exporters/pdf.helpers";
import { formatDateBO } from "@/lib/date-utils";
import type { InitialBalanceStatement, InitialBalanceGroup } from "../../domain/initial-balance.types";

// ── Public types ──────────────────────────────────────────────────────────────

interface InitialBalancePdfResult {
  buffer: Buffer;
  docDef: TDocumentDefinitions;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BODY_SIZE = 8;
const RAZONSOCIAL_SIZE = 11;   // Razón social: bold italic, larger
const HEADER_SIZE = 8;         // Other header fields
const TITLE_SIZE = 12;         // BALANCE INICIAL title
const SUBTITLE_SIZE = 9;       // Subtitle lines
const FOOTER_SIZE = 8;

const STYLE = {
  text: "#000000",
  danger: "#b91c1c",
  muted: "#6b7280",
} as const;

function fmtDateLong(d: Date): string {
  // §13.accounting.calendar-day-T12-utc-unified — TZ-safe ISO-slice.
  // NOTE: name retained as `fmtDateLong` for source-call-site stability, but
  // the format is now numeric DD/MM/YYYY (formatDateBO output). The long
  // "DD de mes de YYYY" variant was lossy on T00 calendar-day inputs (drifted
  // D-1 in BO TZ); uniformly numeric matches the rest of the §13 sweep.
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

function numCell(text: string, bold: boolean): Content {
  return {
    text,
    fontSize: BODY_SIZE,
    bold,
    alignment: "right",
    margin: [1, 1, 4, 1],
  };
}

// ── Group rows builder ────────────────────────────────────────────────────────

function buildGroupRows(group: InitialBalanceGroup): Content[][] {
  const rows: Content[][] = [];

  // Subtype label row (left-aligned, bold, small indent)
  rows.push([
    textCell(`${group.label}:`, { bold: true, fontSize: BODY_SIZE, margin: [4, 3, 2, 2] }),
    textCell("", { bold: true }),
  ]);

  // Detail rows — code + name format; skip zero-amount rows
  for (const row of group.rows) {
    if (row.amount.isZero()) continue;
    rows.push([
      textCell(`  ${row.code} — ${row.name}`, { margin: [12, 1, 2, 1] }),
      numCell(fmtDecimal(row.amount, false), false),
    ]);
  }

  // Subtotal row — single thin rule above
  rows.push([
    textCell(`  Total ${group.label}`, { bold: true, margin: [12, 2, 2, 2] }),
    numCell(fmtDecimal(group.subtotal, true), true),
  ]);

  return rows;
}

// ── Table layout with heavy top rule on first row ─────────────────────────────

function buildSectionTableLayout(totalRows: number): Record<string, unknown> {
  return {
    hLineWidth: (i: number) => {
      if (i === 0) return 1;     // heavy top rule on section header
      if (i === 1) return 0;     // no line after section header
      if (i === totalRows) return 2;  // double bottom rule on section total
      return 0;
    },
    vLineWidth: () => 0,
    hLineColor: () => STYLE.text,
    paddingLeft: () => 0,
    paddingRight: () => 0,
    paddingTop: () => 1,
    paddingBottom: () => 1,
  };
}

// ── Doc definition ────────────────────────────────────────────────────────────

function buildDocDefinition(statement: InitialBalanceStatement): TDocumentDefinitions {
  const { org, dateAt, sections, imbalanced, imbalanceDelta, multipleCA } = statement;
  const [activoSection, pasivoSection] = sections;
  const fechaLarga = fmtDateLong(dateAt);

  const COL_WIDTHS = ["*", 100];

  // ── Header content — LEFT aligned, Bolivian legal format ───────────────────
  const headerContent: Content[] = [
    // Razón social: bold italic, larger, left aligned
    textCell(org.razonSocial, {
      bold: true,
      italics: true,
      fontSize: RAZONSOCIAL_SIZE,
      alignment: "left",
      margin: [0, 0, 0, 2],
    }),
    // De: representante legal
    textCell(`De: ${org.representanteLegal}`, {
      fontSize: HEADER_SIZE,
      alignment: "left",
      margin: [0, 0, 0, 2],
    }),
    // NIT
    textCell(`NIT: ${org.nit}`, {
      fontSize: HEADER_SIZE,
      alignment: "left",
      margin: [0, 0, 0, 2],
    }),
    // Dirección (line 1)
    textCell(org.direccion, {
      fontSize: HEADER_SIZE,
      alignment: "left",
      margin: [0, 0, 0, 2],
    }),
    // Ciudad (line 2 — separate from dirección)
    textCell(org.ciudad, {
      fontSize: HEADER_SIZE,
      alignment: "left",
      margin: [0, 0, 0, 8],
    }),
    // Title: BALANCE INICIAL — big, bold, centered
    textCell("BALANCE INICIAL", {
      bold: true,
      fontSize: TITLE_SIZE,
      alignment: "center",
      margin: [0, 4, 0, 2],
    }),
    // Subtitle: Al {date} — centered, smaller
    textCell(`Al ${fechaLarga}`, {
      fontSize: SUBTITLE_SIZE,
      alignment: "center",
      margin: [0, 0, 0, 2],
    }),
    // Expression: (Expresado en Bolivianos) — italic, centered, smaller
    textCell("(Expresado en Bolivianos)", {
      italics: true,
      fontSize: SUBTITLE_SIZE,
      alignment: "center",
      margin: [0, 0, 0, 10],
    }),
  ];

  // ── Imbalance banner ────────────────────────────────────────────────────────
  const imbalanceBanner: Content[] = imbalanced
    ? [{
        text: `ADVERTENCIA: El balance inicial está desbalanceado — Diferencia: Bs. ${fmtDecimal(imbalanceDelta, true)}`,
        fontSize: BODY_SIZE,
        color: STYLE.danger,
        bold: true,
        margin: [0, 0, 0, 4],
      }]
    : [];

  // ── Multiple CA banner ──────────────────────────────────────────────────────
  const multipleCaBanner: Content[] = multipleCA
    ? [{
        text: `AVISO: Se encontraron ${statement.caCount} comprobantes de apertura (CA). Los saldos mostrados son el consolidado de todos los CA contabilizados.`,
        fontSize: BODY_SIZE,
        color: STYLE.muted,
        margin: [0, 0, 0, 4],
      }]
    : [];

  // ── ACTIVO section table ────────────────────────────────────────────────────
  const activoBodyRows: Content[][] = [];

  // Section label — CENTERED, heavy top rule (enforced by layout)
  activoBodyRows.push([
    textCell("ACTIVO", {
      bold: true,
      fontSize: HEADER_SIZE,
      alignment: "center",
      margin: [4, 4, 2, 4],
    }),
    textCell("", { bold: true }),
  ]);

  for (const group of activoSection.groups) {
    activoBodyRows.push(...buildGroupRows(group));
  }

  // Section total — bold, double rule above (enforced by layout)
  activoBodyRows.push([
    textCell("Total activo", { bold: true, fontSize: BODY_SIZE, margin: [4, 3, 2, 3] }),
    numCell(fmtDecimal(activoSection.sectionTotal, true), true),
  ]);

  // ── PASIVO Y PATRIMONIO section table ───────────────────────────────────────
  const pasivoBodyRows: Content[][] = [];

  pasivoBodyRows.push([
    textCell("PASIVO Y PATRIMONIO", {
      bold: true,
      fontSize: HEADER_SIZE,
      alignment: "center",
      margin: [4, 4, 2, 4],
    }),
    textCell("", { bold: true }),
  ]);

  for (const group of pasivoSection.groups) {
    pasivoBodyRows.push(...buildGroupRows(group));
  }

  pasivoBodyRows.push([
    textCell("Total pasivo y patrimonio", { bold: true, fontSize: BODY_SIZE, margin: [4, 3, 2, 3] }),
    numCell(fmtDecimal(pasivoSection.sectionTotal, true), true),
  ]);

  // ── Signature footer — ONE signature, representante legal, centered ─────────
  const signatureBlock: Content[] = [
    // City + date footer line
    {
      text: `${org.ciudad}, ${fechaLarga}`,
      fontSize: FOOTER_SIZE,
      alignment: "center",
      margin: [0, 16, 0, 0],
    },
    // Large vertical gap (~3 lines)
    { text: "\n\n\n", fontSize: BODY_SIZE },
    // Single centered signature block
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
      layout: buildSectionTableLayout(activoBodyRows.length),
      margin: [0, 0, 0, 6],
    },
    {
      table: {
        widths: COL_WIDTHS,
        body: pasivoBodyRows,
        dontBreakRows: false,
      },
      layout: buildSectionTableLayout(pasivoBodyRows.length),
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
