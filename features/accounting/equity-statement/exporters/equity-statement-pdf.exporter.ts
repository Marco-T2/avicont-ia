import type { TDocumentDefinitions } from "pdfmake/interfaces";
import { registerFonts, pdfmakeRuntime } from "../../financial-statements/exporters/pdf.fonts";
import { fmtDecimal } from "../../financial-statements/exporters/pdf.helpers";
import type { EquityStatement } from "../equity-statement.types";
import {
  COLUMNS_ORDER,
  COLUMN_LABELS,
} from "../equity-statement.builder";
import { Prisma } from "@/generated/prisma/client";

// ── Error ─────────────────────────────────────────────────────────────────────

export class MissingOrgNameError extends Error {
  constructor() {
    super("orgName is required for PDF export");
    this.name = "MissingOrgNameError";
  }
}

// ── Public types ──────────────────────────────────────────────────────────────

interface EquityStatementPdfResult {
  buffer: Buffer;
  docDef: TDocumentDefinitions;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BODY_SIZE = 7;
const HEADER_SIZE = 7;
const TITLE_SIZE = 11;
const SUBTITLE_SIZE = 8;

const STYLE = {
  text: "#000000",
  danger: "#b91c1c",
} as const;

function fmtDate(d: Date): string {
  return d.toLocaleDateString("es-BO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/La_Paz",
  });
}

// ── Cell helpers ──────────────────────────────────────────────────────────────

type Content = Record<string, unknown>;

function numCell(text: string, bold: boolean): Content {
  return { text, fontSize: BODY_SIZE, bold, alignment: "right", margin: [1, 1, 2, 1] };
}

function labelCell(text: string, bold: boolean): Content {
  return { text, fontSize: BODY_SIZE, bold, alignment: "left", margin: [2, 1, 2, 1] };
}

function headerCell(text: string): Content {
  return { text, fontSize: HEADER_SIZE, bold: true, alignment: "center", margin: [1, 2, 1, 2], fillColor: "#f3f4f6" };
}

// ── Doc definition ────────────────────────────────────────────────────────────

function buildDocDefinition(
  statement: EquityStatement,
  orgName: string,
  orgNit?: string,
  orgAddress?: string,
): TDocumentDefinitions {
  // Determine visible columns
  const visibleCols = COLUMNS_ORDER.filter((key) => {
    const col = statement.columns.find((c) => c.key === key);
    return col?.visible ?? key !== "OTROS_PATRIMONIO";
  });

  // Column widths — Concepto + visible cols + Total
  const numCols = visibleCols.length + 1; // +1 for total
  const conceptWidth = 140;
  const numWidth = Math.floor((792 - conceptWidth) / numCols);
  const colWidths: (number | string)[] = [conceptWidth, ...Array(numCols).fill(numWidth)];

  // Header content
  const headerContent: Content[] = [];
  headerContent.push({ text: `Empresa: ${orgName}`, fontSize: SUBTITLE_SIZE, bold: true, alignment: "center", margin: [0, 0, 0, 2] });
  const nitPart = orgNit ? `NIT: ${orgNit}` : null;
  const addrPart = orgAddress ? `Dirección: ${orgAddress}` : null;
  const line2 = [nitPart, addrPart].filter(Boolean).join(" · ");
  if (line2) {
    headerContent.push({ text: line2, fontSize: SUBTITLE_SIZE, alignment: "center", margin: [0, 0, 0, 2] });
  }
  headerContent.push({ text: "ESTADO DE EVOLUCIÓN DEL PATRIMONIO NETO", fontSize: TITLE_SIZE, bold: true, alignment: "center", margin: [0, 2, 0, 2] });
  headerContent.push({ text: `DEL ${fmtDate(statement.dateFrom)} AL ${fmtDate(statement.dateTo)}`, fontSize: SUBTITLE_SIZE, alignment: "center", margin: [0, 0, 0, 2] });
  headerContent.push({ text: "(Expresado en Bolivianos)", fontSize: SUBTITLE_SIZE, italics: true, alignment: "center", margin: [0, 0, 0, 6] });

  const imbalanceBanner: Content[] = statement.imbalanced
    ? [{
        text: `Diferencia patrimonial sin clasificar: Bs. ${fmtDecimal(statement.imbalanceDelta, true)}. Probables causas: aportes de capital, distribuciones a socios o constitución de reservas durante el período.`,
        fontSize: BODY_SIZE,
        color: STYLE.danger,
        bold: true,
        margin: [0, 0, 0, 4],
      }]
    : [];

  // Table header row
  const tableHeaderRow: Content[] = [
    headerCell("Descripción"),
    ...visibleCols.map((key) => headerCell(COLUMN_LABELS[key])),
    headerCell("Total Patrimonio"),
  ];

  // Body rows — bold-detection is keyed on row.key so N-row statements work
  const bodyRows: Content[][] = statement.rows.map((row) => {
    const isBold = row.key === "SALDO_FINAL";
    const cells: Content[] = [labelCell(row.label, isBold)];
    for (const col of visibleCols) {
      const cell = row.cells.find((c) => c.column === col);
      cells.push(numCell(fmtDecimal(cell?.amount ?? new Prisma.Decimal(0), isBold), isBold));
    }
    cells.push(numCell(fmtDecimal(row.total, isBold), isBold));
    return cells;
  });

  const tableBody: Content[][] = [tableHeaderRow, ...bodyRows];

  const content: Content[] = [
    ...headerContent,
    ...imbalanceBanner,
    {
      table: {
        widths: colWidths,
        body: tableBody,
        headerRows: 1,
        dontBreakRows: false,
      },
      layout: {
        hLineWidth: (i: number, node: { table: { body: unknown[] } }) => {
          if (i === 0 || i === 1) return 0.5;
          if (i === node.table.body.length) return 0.5;
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
    },
  ];

  const watermark = statement.preliminary ? { text: "PRELIMINAR", angle: 45, opacity: 0.15, bold: true, color: "#6b7280", fontSize: 60 } : undefined;

  return {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [25, 45, 25, 35],
    defaultStyle: { font: "Roboto", fontSize: BODY_SIZE, color: STYLE.text },
    content: content as unknown as import("pdfmake/interfaces").Content[],
    ...(watermark ? { watermark } : {}),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function exportEquityStatementPdf(
  statement: EquityStatement,
  orgName: string,
  orgNit?: string,
  orgAddress?: string,
): Promise<EquityStatementPdfResult> {
  if (!orgName) throw new MissingOrgNameError();

  registerFonts();
  const docDef = buildDocDefinition(statement, orgName, orgNit, orgAddress);
  const buffer = await pdfmakeRuntime.createPdf(docDef).getBuffer();
  return { buffer: Buffer.from(buffer), docDef };
}
