/**
 * REQ-010 RESOLVED — shared pdf infrastructure.
 *
 * This file imports `registerFonts`, `pdfmakeRuntime` and `fmtDecimal` from
 * `@/modules/accounting/shared/infrastructure/exporters/{pdf.fonts,pdf.helpers}`.
 *
 * pdf.fonts.ts + pdf.helpers.ts were git-mv'd from FS-infra to the shared
 * canonical home at **sub-POC 6 (poc-accounting-exporters-cleanup)** — the
 * cross-module FS-INFRA tech debt no longer exists.
 *
 * **Boundary rule**: this file MUST NOT import from
 * `@/modules/accounting/financial-statements/*` (the closed-POC C2 sentinel
 * still asserts this).
 */
import type { TDocumentDefinitions } from "pdfmake/interfaces";
import { registerFonts, pdfmakeRuntime } from "@/modules/accounting/shared/infrastructure/exporters/pdf.fonts";
import { fmtDecimal } from "@/modules/accounting/shared/infrastructure/exporters/pdf.helpers";
import { buildExecutivePdfHeader } from "@/modules/accounting/shared/infrastructure/exporters/executive-pdf-header";
import { formatDateBO } from "@/lib/date-utils";
import type { EquityStatement } from "../../domain/equity-statement.types";
import {
  COLUMNS_ORDER,
  COLUMN_LABELS,
} from "../../domain/equity-statement.builder";
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

const BODY_SIZE = 7;            // landscape con N cols visibles — body chico
const HEADER_SIZE = 7;          // header de columnas de la tabla
const TITLE_SIZE = 16;          // "ESTADO DE EVOLUCIÓN..." (landscape, un poco menor que portrait 18)
const SUBTITLE_SIZE = 10;       // período + (Expresado en Bolivianos)
const ORG_INFO_SIZE = 8;        // Empresa/NIT/Dirección/Ciudad — izquierda

const STYLE = {
  text: "#000000",
  danger: "#b91c1c",
} as const;

function fmtDate(d: Date): string {
  // §13.accounting.calendar-day-T12-utc-unified — TZ-safe ISO-slice.
  return formatDateBO(d);
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
  orgCity?: string,
): TDocumentDefinitions {
  // Determine visible columns
  const visibleCols = COLUMNS_ORDER.filter((key) => {
    const col = statement.columns.find((c) => c.key === key);
    return col?.visible ?? key !== "OTROS_PATRIMONIO";
  });

  // Column widths — Concepto + visible cols + Total. Concepto y resto usan
  // "*" para que pdfmake distribuya canto a canto la zona de números.
  const conceptWidth = 140;
  const numColsWithTotal = visibleCols.length + 1;
  const colWidths: (number | string)[] = [conceptWidth, ...Array(numColsWithTotal).fill("*")];

  // Header ejecutivo compartido (Empresa/NIT/Dir/Ciudad izquierda 8pt +
  // título centrado 16pt + período + Expresado en Bolivianos)
  const headerContent = buildExecutivePdfHeader({
    orgName,
    orgNit,
    orgAddress,
    orgCity,
    title: "Estado de Evolución del Patrimonio Neto",
    subtitle: `Del ${fmtDate(statement.dateFrom)} al ${fmtDate(statement.dateTo)}`,
    titleFontSize: TITLE_SIZE,
    subtitleFontSize: SUBTITLE_SIZE,
    orgInfoFontSize: ORG_INFO_SIZE,
    orgInfoAlignment: "left",
  }) as unknown as Content[];

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

  return {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [25, 45, 25, 35],
    defaultStyle: { font: "Roboto", fontSize: BODY_SIZE, color: STYLE.text },
    content: content as unknown as import("pdfmake/interfaces").Content[],
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function exportEquityStatementPdf(
  statement: EquityStatement,
  orgName: string,
  orgNit?: string,
  orgAddress?: string,
  orgCity?: string,
): Promise<EquityStatementPdfResult> {
  if (!orgName) throw new MissingOrgNameError();

  registerFonts();
  const docDef = buildDocDefinition(statement, orgName, orgNit, orgAddress, orgCity);
  const buffer = await pdfmakeRuntime.createPdf(docDef).getBuffer();
  return { buffer: Buffer.from(buffer), docDef };
}
