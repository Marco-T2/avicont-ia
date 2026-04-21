import type { TDocumentDefinitions } from "pdfmake/interfaces";
import { registerFonts, pdfmakeRuntime } from "../../financial-statements/exporters/pdf.fonts";
import type { InitialBalanceStatement, InitialBalanceGroup } from "../initial-balance.types";
import { Prisma } from "@/generated/prisma/client";

// ── Public types ──────────────────────────────────────────────────────────────

export interface InitialBalancePdfResult {
  buffer: Buffer;
  docDef: TDocumentDefinitions;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BODY_SIZE = 8;
const HEADER_SIZE = 8;
const TITLE_SIZE = 11;
const SUBTITLE_SIZE = 9;

const STYLE = {
  text: "#000000",
  danger: "#b91c1c",
  muted: "#6b7280",
} as const;

// ── Decimal helpers ───────────────────────────────────────────────────────────

type DecimalLike = {
  isZero(): boolean;
  isNegative(): boolean;
  abs(): { toNumber(): number };
  toNumber(): number;
};

function fmtDecimal(d: DecimalLike, isTotal: boolean): string {
  if (d.isZero()) {
    return isTotal
      ? (0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "";
  }
  if (d.isNegative()) {
    const abs = d.abs().toNumber().toLocaleString("es-BO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `(${abs})`;
  }
  return d.toNumber().toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDateLong(d: Date): string {
  return d.toLocaleDateString("es-BO", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/La_Paz",
  });
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

  // Subtype header
  rows.push([
    textCell(group.label, { bold: true, fontSize: BODY_SIZE, margin: [4, 3, 2, 2] }),
    textCell("", { bold: true }),
  ]);

  // Detail rows
  for (const row of group.rows) {
    rows.push([
      textCell(`  ${row.code} — ${row.name}`, { margin: [12, 1, 2, 1] }),
      numCell(fmtDecimal(row.amount, false), false),
    ]);
  }

  // Subtotal row
  rows.push([
    textCell(`Total ${group.label}`, { bold: true, margin: [4, 2, 2, 2] }),
    numCell(fmtDecimal(group.subtotal, true), true),
  ]);

  return rows;
}

// ── Doc definition ────────────────────────────────────────────────────────────

function buildDocDefinition(statement: InitialBalanceStatement): TDocumentDefinitions {
  const { org, dateAt, sections, imbalanced, imbalanceDelta, multipleCA } = statement;
  const [activoSection, pasivoSection] = sections;

  const COL_WIDTHS = ["*", 100];

  // ── Header content ──────────────────────────────────────────────────────────
  const headerContent: Content[] = [
    textCell(org.razonSocial, {
      bold: true,
      fontSize: TITLE_SIZE,
      alignment: "center",
      margin: [0, 0, 0, 2],
    }),
    textCell(`NIT: ${org.nit}`, {
      fontSize: SUBTITLE_SIZE,
      alignment: "center",
      margin: [0, 0, 0, 2],
    }),
    textCell(`Representante Legal: ${org.representanteLegal}`, {
      fontSize: SUBTITLE_SIZE,
      alignment: "center",
      margin: [0, 0, 0, 2],
    }),
    textCell(`Dirección: ${org.direccion}`, {
      fontSize: SUBTITLE_SIZE,
      alignment: "center",
      margin: [0, 0, 0, 4],
    }),
    textCell(`BALANCE INICIAL — Al ${fmtDateLong(dateAt)}`, {
      bold: true,
      fontSize: TITLE_SIZE,
      alignment: "center",
      margin: [0, 4, 0, 2],
    }),
    textCell("(Expresado en Bolivianos)", {
      italics: true,
      fontSize: SUBTITLE_SIZE,
      alignment: "center",
      margin: [0, 0, 0, 8],
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

  // Section header row
  activoBodyRows.push([
    textCell("ACTIVO", { bold: true, fontSize: HEADER_SIZE, margin: [4, 4, 2, 4] }),
    textCell("", { bold: true }),
  ]);

  for (const group of activoSection.groups) {
    activoBodyRows.push(...buildGroupRows(group));
  }

  // Section total
  activoBodyRows.push([
    textCell("TOTAL ACTIVO", { bold: true, fontSize: BODY_SIZE, margin: [4, 3, 2, 3] }),
    numCell(fmtDecimal(activoSection.sectionTotal, true), true),
  ]);

  // ── PASIVO Y PATRIMONIO section table ───────────────────────────────────────
  const pasivoBodyRows: Content[][] = [];

  pasivoBodyRows.push([
    textCell("PASIVO Y PATRIMONIO", { bold: true, fontSize: HEADER_SIZE, margin: [4, 4, 2, 4] }),
    textCell("", { bold: true }),
  ]);

  for (const group of pasivoSection.groups) {
    pasivoBodyRows.push(...buildGroupRows(group));
  }

  pasivoBodyRows.push([
    textCell("TOTAL PASIVO Y PATRIMONIO", { bold: true, fontSize: BODY_SIZE, margin: [4, 3, 2, 3] }),
    numCell(fmtDecimal(pasivoSection.sectionTotal, true), true),
  ]);

  const tableLayout = {
    hLineWidth: (i: number, node: { table: { body: unknown[] } }) => {
      if (i === 0 || i === 1) return 0.5;
      if (i === node.table.body.length) return 0.5;
      return 0;
    },
    vLineWidth: () => 0,
    hLineColor: () => STYLE.text,
    paddingLeft: () => 0,
    paddingRight: () => 0,
    paddingTop: () => 1,
    paddingBottom: () => 1,
  };

  // ── Signature footer ────────────────────────────────────────────────────────
  const signatureBlock: Content[] = [
    {
      text: "\n\n",
      fontSize: BODY_SIZE,
    },
    {
      columns: [
        {
          stack: [
            { text: "_______________________________", fontSize: BODY_SIZE, alignment: "center" },
            { text: org.representanteLegal, fontSize: BODY_SIZE, bold: true, alignment: "center" },
            { text: "Representante Legal", fontSize: SUBTITLE_SIZE - 1, alignment: "center", color: STYLE.muted },
          ],
          width: "50%",
          margin: [0, 0, 0, 0],
        },
        { text: "", width: "50%" },
      ],
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
      layout: tableLayout,
      margin: [0, 0, 0, 8],
    },
    {
      table: {
        widths: COL_WIDTHS,
        body: pasivoBodyRows,
        dontBreakRows: false,
      },
      layout: tableLayout,
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
