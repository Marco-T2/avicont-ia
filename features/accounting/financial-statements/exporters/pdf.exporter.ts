// Exporter de PDF usando pdfmake con fuentes Roboto bundled.
// Funciones puras: reciben datos ya calculados → retornan Promise<Buffer>.
// Sin Prisma, sin Clerk, sin acceso al sistema de archivos.

import type { TDocumentDefinitions, Content, Watermark } from "pdfmake/interfaces";
import { registerFonts, pdfmakeRuntime } from "./pdf.fonts";
import type { ExportRow, ExportSheet } from "./statement-shape";
import { buildBalanceSheetExportSheet, buildIncomeStatementExportSheet } from "./sheet.builder";
import type { BalanceSheet, IncomeStatement } from "../financial-statements.types";

// ── Constantes de estilo ──

const COLORS = {
  headerBg: "#1e3a5f",
  headerFg: "#ffffff",
  sectionBg: "#2d6a9f",
  sectionFg: "#ffffff",
  subtypeBg: "#dce6f1",
  subtypeFg: "#1e3a5f",
  totalBg: "#f0f0f0",
  imbalanceBg: "#ffcccc",
  imbalanceFg: "#cc0000",
  bodyFg: "#333333",
  borderColor: "#cccccc",
} as const;

const FONT_SIZES = {
  title: 14,
  subtitle: 10,
  sectionHeader: 9,
  body: 8,
  footer: 7,
} as const;

// ── Funciones auxiliares de construcción de contenido ──

/**
 * Convierte una fila de ExportSheet en una fila de tabla pdfmake.
 */
function rowToTableRow(row: ExportRow): Content[] {
  const marginLeft = row.indent * 8;

  switch (row.type) {
    case "header-section":
      return [
        {
          text: row.label,
          bold: true,
          fontSize: FONT_SIZES.sectionHeader,
          color: COLORS.sectionFg,
          fillColor: COLORS.sectionBg,
          colSpan: 3,
          margin: [marginLeft + 4, 3, 4, 3],
        } as Content,
        {} as Content,
        {} as Content,
      ];

    case "header-subtype":
      return [
        {
          text: row.label,
          bold: true,
          fontSize: FONT_SIZES.body,
          color: COLORS.subtypeFg,
          fillColor: COLORS.subtypeBg,
          colSpan: 3,
          margin: [marginLeft + 4, 2, 4, 2],
        } as Content,
        {} as Content,
        {} as Content,
      ];

    case "account":
      return [
        {
          text: row.label,
          fontSize: FONT_SIZES.body,
          color: COLORS.bodyFg,
          margin: [marginLeft + 4, 1, 4, 1],
        } as Content,
        {
          text: row.code ?? "",
          fontSize: FONT_SIZES.body,
          color: COLORS.bodyFg,
          alignment: "center",
          margin: [2, 1, 2, 1],
        } as Content,
        {
          text: row.balance ?? "",
          fontSize: FONT_SIZES.body,
          color: COLORS.bodyFg,
          alignment: "right",
          margin: [2, 1, 4, 1],
        } as Content,
      ];

    case "subtotal":
      return [
        {
          text: row.label,
          bold: true,
          fontSize: FONT_SIZES.body,
          color: COLORS.bodyFg,
          fillColor: COLORS.totalBg,
          margin: [marginLeft + 4, 2, 4, 2],
        } as Content,
        { text: "", fillColor: COLORS.totalBg } as Content,
        {
          text: row.balance ?? "",
          bold: true,
          fontSize: FONT_SIZES.body,
          color: COLORS.bodyFg,
          fillColor: COLORS.totalBg,
          alignment: "right",
          margin: [2, 2, 4, 2],
        } as Content,
      ];

    case "total":
      return [
        {
          text: row.label,
          bold: true,
          fontSize: FONT_SIZES.sectionHeader,
          color: COLORS.headerFg,
          fillColor: COLORS.headerBg,
          margin: [4, 3, 4, 3],
        } as Content,
        { text: "", fillColor: COLORS.headerBg } as Content,
        {
          text: row.balance ?? "",
          bold: true,
          fontSize: FONT_SIZES.sectionHeader,
          color: COLORS.headerFg,
          fillColor: COLORS.headerBg,
          alignment: "right",
          margin: [2, 3, 4, 3],
        } as Content,
      ];

    case "imbalance":
      return [
        {
          text: row.label,
          bold: true,
          fontSize: FONT_SIZES.body,
          color: COLORS.imbalanceFg,
          fillColor: COLORS.imbalanceBg,
          colSpan: 3,
          margin: [4, 3, 4, 3],
        } as Content,
        {} as Content,
        {} as Content,
      ];

    default:
      return [{ text: row.label, colSpan: 3 } as Content, {} as Content, {} as Content];
  }
}

/**
 * Construye el docDefinition de pdfmake a partir de un ExportSheet.
 */
function buildDocDefinition(exportSheet: ExportSheet): TDocumentDefinitions {
  const generatedAt = new Date().toLocaleString("es-BO", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Filas de la tabla principal: encabezado de columnas + filas de datos
  const tableBody: Content[][] = [
    [
      {
        text: "Cuenta",
        bold: true,
        fontSize: FONT_SIZES.body,
        fillColor: COLORS.subtypeBg,
        margin: [4, 3, 4, 3],
      } as Content,
      {
        text: "Código",
        bold: true,
        fontSize: FONT_SIZES.body,
        fillColor: COLORS.subtypeBg,
        alignment: "center",
        margin: [2, 3, 2, 3],
      } as Content,
      {
        text: "Saldo BOB",
        bold: true,
        fontSize: FONT_SIZES.body,
        fillColor: COLORS.subtypeBg,
        alignment: "right",
        margin: [2, 3, 4, 3],
      } as Content,
    ],
  ];

  for (const row of exportSheet.rows) {
    tableBody.push(rowToTableRow(row));
  }

  // Watermark PRELIMINAR (REQ-7): texto diagonal semitransparente
  const watermark: Watermark | undefined = exportSheet.preliminary
    ? {
        text: "PRELIMINAR",
        color: "#2d6a9f",
        opacity: 0.15,
        bold: true,
        italics: false,
      }
    : undefined;

  // Banner de desbalance al inicio del contenido (REQ-6)
  const imbalanceBanner: Content[] = exportSheet.imbalanced
    ? [
        {
          text: `Ecuacion contable desbalanceada - Delta: ${exportSheet.imbalanceDelta ?? ""} BOB`,
          fontSize: FONT_SIZES.body,
          color: COLORS.imbalanceFg,
          bold: true,
          fillColor: COLORS.imbalanceBg,
          margin: [0, 0, 0, 6],
        } as Content,
      ]
    : [];

  const docDef: TDocumentDefinitions = {
    pageSize: "LETTER",
    pageOrientation: "portrait",
    pageMargins: [40, 60, 40, 50],

    // Watermark diagonal (solo en estado preliminar)
    ...(watermark ? { watermark } : {}),

    // Encabezado de página
    header: {
      columns: [
        {
          text: exportSheet.orgName,
          fontSize: FONT_SIZES.subtitle,
          bold: true,
          color: COLORS.headerFg,
          margin: [40, 12, 0, 0],
        } as Content,
        {
          text: exportSheet.dateLabel,
          fontSize: FONT_SIZES.subtitle,
          color: COLORS.headerFg,
          alignment: "right",
          margin: [0, 12, 40, 0],
        } as Content,
      ],
      fillColor: COLORS.headerBg,
    } as Content,

    // Pie de página con número de página y timestamp
    footer: (_currentPage: number, _pageCount: number): Content =>
      ({
        columns: [
          {
            text: `Generado: ${generatedAt}`,
            fontSize: FONT_SIZES.footer,
            color: "#888888",
            margin: [40, 0, 0, 0],
          },
          {
            text: `${_currentPage} / ${_pageCount}`,
            fontSize: FONT_SIZES.footer,
            color: "#888888",
            alignment: "right",
            margin: [0, 0, 40, 0],
          },
        ],
      }) as Content,

    defaultStyle: {
      font: "Roboto",
      fontSize: FONT_SIZES.body,
      color: COLORS.bodyFg,
    },

    content: [
      // Título
      {
        text: exportSheet.title,
        fontSize: FONT_SIZES.title,
        bold: true,
        color: COLORS.headerBg,
        alignment: "center",
        margin: [0, 0, 0, 2],
      } as Content,
      // Subtítulo (fecha de corte o rango)
      {
        text: exportSheet.subtitle,
        fontSize: FONT_SIZES.subtitle,
        color: COLORS.bodyFg,
        alignment: "center",
        margin: [0, 0, 0, 8],
      } as Content,
      // Banner de desbalance (si aplica)
      ...imbalanceBanner,
      // Tabla principal
      {
        table: {
          widths: ["*", 60, 80],
          body: tableBody,
          dontBreakRows: false,
        },
        layout: {
          hLineWidth: () => 0.3,
          vLineWidth: () => 0,
          hLineColor: () => COLORS.borderColor,
          paddingLeft: () => 0,
          paddingRight: () => 0,
          paddingTop: () => 0,
          paddingBottom: () => 0,
        },
      } as Content,
    ],
  };

  return docDef;
}

// ── Funciones públicas de export ──

/**
 * Genera el Balance General como Buffer PDF.
 *
 * @param bs      Resultado de `generateBalanceSheet` (con Decimals)
 * @param orgName Nombre de la organización para el encabezado
 * @returns       Buffer con el PDF generado
 */
export async function exportBalanceSheetPdf(bs: BalanceSheet, orgName: string): Promise<Buffer> {
  registerFonts();
  const exportSheet = buildBalanceSheetExportSheet(bs, orgName);
  const docDef = buildDocDefinition(exportSheet);
  return pdfmakeRuntime.createPdf(docDef).getBuffer();
}

/**
 * Genera el Estado de Resultados como Buffer PDF.
 *
 * @param is      Resultado de `generateIncomeStatement` (con Decimals)
 * @param orgName Nombre de la organización para el encabezado
 * @returns       Buffer con el PDF generado
 */
export async function exportIncomeStatementPdf(
  is: IncomeStatement,
  orgName: string,
): Promise<Buffer> {
  registerFonts();
  const exportSheet = buildIncomeStatementExportSheet(is, orgName);
  const docDef = buildDocDefinition(exportSheet);
  return pdfmakeRuntime.createPdf(docDef).getBuffer();
}
