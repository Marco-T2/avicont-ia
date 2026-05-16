// Exporter de PDF usando pdfmake con fuentes Roboto bundled.
// Funciones puras: reciben datos ya calculados → retornan Promise<Buffer>.
// Sin Prisma, sin Clerk, sin acceso al sistema de archivos.
//
// QB-style (QuickBooks Online): portrait SIEMPRE, chunking horizontal.
// Cada "página" repite el encabezado (título + org + período) y muestra
// una porción de columnas de valor. La lista de cuentas se repite en cada
// página — igual que el PDF de referencia de QuickBooks (52 cols semanales
// distribuidas en 8 páginas portrait).
//
// Single-column backward compat: cuando columns.length === 1 se mantiene
// el layout de 3 columnas (Cuenta / Código / Saldo BOB).

import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";
import { registerFonts, pdfmakeRuntime } from "@/modules/accounting/shared/infrastructure/exporters/pdf.fonts";
import { buildExecutivePdfHeader } from "@/modules/accounting/shared/infrastructure/exporters/executive-pdf-header";
import type { ExportColumn, ExportRow, ExportRowType, ExportSheet } from "./statement-shape";
import {
  buildBalanceSheetExportSheet,
  buildIncomeStatementExportSheet,
  chunkColumnsForPage,
  type OrgHeaderMetadata,
} from "./sheet.builder";
import type { BalanceSheet, IncomeStatement } from "../../domain/types/financial-statements.types";

// ── Paleta QB-style: sin fondos de color ──

const STYLE = {
  text: "#000000",
  textMuted: "#6b7280",
  border: "#000000",
  borderLight: "#d1d5db",
  danger: "#b91c1c",
} as const;

/** Tamaño de las filas de datos (cuentas, totales, subtotales). */
const BODY_FONT_SIZE = 10;

/** Tamaño de los encabezados de columna ("Cuenta", "Código", "Saldo BOB"). */
const HEADER_COL_FONT_SIZE = 11;

const BASE_FONT_SIZES = {
  title: 18,           // BALANCE GENERAL / ESTADO DE RESULTADOS — centrado
  orgInfo: 8,          // Empresa + NIT/Dirección — chico, alineado a la derecha (membrete)
  subtitle: 10,        // Fecha "Al ..." + (Expresado en ...)
  footer: 8,           // Generado: dd/mm/yyyy + N / M
} as const;

// ── Helpers de construcción ──

/**
 * Anchos de columna para la tabla pdfmake.
 *
 * Multi-col: [nombre*, val1, val2, ..., valN]
 * Single-col: [nombre*, código(60), saldo(80)]  ← backward compat
 */
function buildColumnWidths(valueColumns: ExportColumn[]): (string | number)[] {
  if (valueColumns.length > 1) {
    const numCols = valueColumns.length;
    const valWidth = Math.min(95, Math.max(60, Math.floor(420 / numCols)));
    return ["*", ...valueColumns.map(() => valWidth)];
  }
  // Single-col: cuenta* + código(75) + saldo(110) — anchos compatibles con 11pt.
  return ["*", 75, 110];
}

/** Total de columnas en la tabla pdfmake. */
function totalPdfCols(valueColumns: ExportColumn[]): number {
  return valueColumns.length > 1
    ? 1 + valueColumns.length
    : 3;
}

/**
 * Fila de span completo (header-section, header-subtype).
 * Sin fillColor — la jerarquía se expresa solo con indentación y negrita.
 */
function buildFullSpanRow(
  label: string,
  fontSize: number,
  bold: boolean,
  color: string,
  indent: number,
  totalCols: number,
): Content[] {
  const marginLeft = indent * 8;
  const cells: Content[] = [
    {
      text: label,
      bold,
      fontSize,
      color,
      colSpan: totalCols,
      margin: [marginLeft + 4, 3, 4, 3],
    } as Content,
  ];
  for (let i = 1; i < totalCols; i++) {
    cells.push({} as Content);
  }
  return cells;
}

/** Celdas de valor para una fila multi-columna. */
function buildValueCells(
  row: ExportRow,
  valueColumns: ExportColumn[],
  bold?: boolean,
): Content[] {
  return valueColumns.map((col) => {
    const val = row.balances?.[col.id] ?? row.balance ?? "";
    const cell: Content = {
      text: val,
      fontSize: BODY_FONT_SIZE,
      alignment: "right",
      margin: [2, 1, 4, 1],
    };
    if (bold) (cell as unknown as Record<string, unknown>).bold = true;
    return cell;
  });
}

/**
 * Convierte una ExportRow en fila de tabla pdfmake.
 *
 * Sin fillColor en ningún caso multi-col.
 * Single-col conserva el layout legado: Cuenta / Código / Saldo BOB.
 */
function rowToTableRow(
  row: ExportRow,
  valueColumns: ExportColumn[],
): Content[] {
  const isMultiCol = valueColumns.length > 1;
  const totalCols = totalPdfCols(valueColumns);
  const marginLeft = row.indent * 8;

  switch (row.type) {
    case "header-section":
      return buildFullSpanRow(row.label, BODY_FONT_SIZE + 1, true, STYLE.text, row.indent, totalCols);

    case "header-subtype":
      return buildFullSpanRow(row.label, BODY_FONT_SIZE, true, STYLE.text, row.indent, totalCols);

    case "account": {
      const nameCell: Content = {
        text: row.label,
        fontSize: BODY_FONT_SIZE,
        color: STYLE.text,
        margin: [marginLeft + 4, 1, 4, 1],
      };
      if (isMultiCol) {
        return [nameCell, ...buildValueCells(row, valueColumns)];
      }
      return [
        nameCell,
        {
          text: row.code ?? "",
          fontSize: BODY_FONT_SIZE,
          color: STYLE.text,
          alignment: "center",
          margin: [2, 1, 2, 1],
        } as Content,
        {
          text: row.balance ?? "",
          fontSize: BODY_FONT_SIZE,
          color: STYLE.text,
          alignment: "right",
          margin: [2, 1, 4, 1],
        } as Content,
      ];
    }

    case "subtotal": {
      const nameCell: Content = {
        text: row.label,
        bold: true,
        fontSize: BODY_FONT_SIZE,
        color: STYLE.text,
        margin: [marginLeft + 4, 2, 4, 2],
      };
      if (isMultiCol) {
        return [nameCell, ...buildValueCells(row, valueColumns, true)];
      }
      return [
        nameCell,
        { text: "" } as Content,
        {
          text: row.balance ?? "",
          bold: true,
          fontSize: BODY_FONT_SIZE,
          color: STYLE.text,
          alignment: "right",
          margin: [2, 2, 4, 2],
        } as Content,
      ];
    }

    case "total": {
      const nameCell: Content = {
        text: row.label,
        bold: true,
        fontSize: BODY_FONT_SIZE,
        color: STYLE.text,
        margin: [4, 3, 4, 3],
      };
      if (isMultiCol) {
        return [nameCell, ...buildValueCells(row, valueColumns, true)];
      }
      return [
        nameCell,
        { text: "" } as Content,
        {
          text: row.balance ?? "",
          bold: true,
          fontSize: BODY_FONT_SIZE,
          color: STYLE.text,
          alignment: "right",
          margin: [2, 3, 4, 3],
        } as Content,
      ];
    }

    case "imbalance":
      // Solo el texto va en rojo — sin fillColor.
      return buildFullSpanRow(row.label, BODY_FONT_SIZE, true, STYLE.danger, row.indent, totalCols);

    default:
      return buildFullSpanRow(row.label, BODY_FONT_SIZE, false, STYLE.text, row.indent, totalCols);
  }
}

/**
 * Construye los bloques de contenido pdfmake para una página (chunk de columnas).
 *
 * Cada página incluye:
 * - Header ejecutivo (Empresa / NIT · Dirección / TÍTULO / período / Expresado en)
 * - Banner de desbalance (solo en la primera página)
 * - Tabla con el chunk de columnas de valor
 */
function buildPageSection(
  exportSheet: ExportSheet,
  valueColumns: ExportColumn[],
  isFirstPage: boolean,
  rowTypes: ExportRowType[],
): Content[] {
  // Fila de encabezado de columnas — un punto más grande que el body
  const headerRow: Content[] = [
    {
      text: "Cuenta",
      bold: true,
      fontSize: HEADER_COL_FONT_SIZE,
      margin: [4, 4, 4, 4],
    } as Content,
  ];

  if (valueColumns.length > 1) {
    for (const col of valueColumns) {
      headerRow.push({
        text: col.label,
        bold: true,
        fontSize: HEADER_COL_FONT_SIZE,
        alignment: "right",
        margin: [2, 4, 4, 4],
      } as Content);
    }
  } else {
    headerRow.push(
      {
        text: "Código",
        bold: true,
        fontSize: HEADER_COL_FONT_SIZE,
        alignment: "center",
        margin: [2, 4, 2, 4],
      } as Content,
      {
        text: "Saldo BOB",
        bold: true,
        fontSize: HEADER_COL_FONT_SIZE,
        alignment: "right",
        margin: [2, 4, 4, 4],
      } as Content,
    );
  }

  const tableBody: Content[][] = [headerRow];
  for (const row of exportSheet.rows) {
    tableBody.push(rowToTableRow(row, valueColumns));
  }

  // rowTypes[i] corresponde a tableBody[i+1] (i+1 porque la fila 0 es el header).
  // El layout usa este array via closure para dibujar líneas encima de total/subtotal.
  const layout = {
    // Líneas horizontales:
    //   i=0: encima de la fila de encabezado (no se dibuja)
    //   i=1: entre header y primera fila de datos → línea delgada (debajo del header)
    //   i=2..N-1: entre filas de datos
    //   i=N: debajo de la última fila
    hLineWidth: (i: number, node: { table: { body: unknown[] } }) => {
      const totalRows = node.table.body.length;
      // Línea encima y debajo del header de columnas (fila 0 de tableBody → índice 0 y 1)
      if (i === 1 || i === 2) return 0.5;
      // Línea encima de total/subtotal rows — rowTypes indexa desde 0 para la primera fila de datos
      const dataRowIndex = i - 2; // offset: 0=header+sep, 1=sep+first-data
      if (dataRowIndex >= 0 && dataRowIndex < rowTypes.length) {
        const type = rowTypes[dataRowIndex];
        if (type === "total" || type === "subtotal") return 0.5;
      }
      // Línea debajo de la última fila (gran total)
      if (i === totalRows) return 0.5;
      return 0;
    },
    vLineWidth: () => 0,
    hLineColor: () => STYLE.border,
    paddingLeft: () => 0,
    paddingRight: () => 0,
    paddingTop: () => 2,
    paddingBottom: () => 2,
  };

  const imbalanceBanner: Content[] =
    isFirstPage && exportSheet.imbalanced
      ? [
          {
            text: `Ecuación contable desbalanceada — Delta: ${exportSheet.imbalanceDelta ?? ""} BOB`,
            fontSize: BODY_FONT_SIZE,
            color: STYLE.danger,
            bold: true,
            margin: [0, 0, 0, 6],
          } as Content,
        ]
      : [];

  return [
    ...buildExecutivePdfHeader({
      orgName: exportSheet.orgName,
      orgNit: exportSheet.orgNit,
      orgAddress: exportSheet.orgAddress,
      orgCity: exportSheet.orgCity,
      title: exportSheet.title,
      subtitle: exportSheet.subtitle,
      titleFontSize: BASE_FONT_SIZES.title,
      subtitleFontSize: BASE_FONT_SIZES.subtitle,
      orgInfoFontSize: BASE_FONT_SIZES.orgInfo,
      orgInfoAlignment: "left",
    }),
    ...imbalanceBanner,
    {
      table: {
        widths: buildColumnWidths(valueColumns),
        body: tableBody,
        dontBreakRows: false,
        headerRows: 1,
      },
      layout,
    } as Content,
  ];
}

/**
 * Construye el docDefinition de pdfmake a partir de un ExportSheet.
 *
 * Portrait SIEMPRE. Columnas divididas en chunks (QB-style).
 * Cada chunk ocupa una "sección de página" con el encabezado repetido.
 */
function buildDocDefinition(exportSheet: ExportSheet): TDocumentDefinitions {
  const allColumns = exportSheet.columns;
  const isMultiCol = allColumns.length > 1;

  // Para single-column no chunkeamos — backward compat.
  const chunks = isMultiCol ? chunkColumnsForPage(allColumns) : [allColumns];

  const generatedAt = new Date().toLocaleString("es-BO", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Parallel array de tipos de fila para el layout de líneas.
  const rowTypes: ExportRowType[] = exportSheet.rows.map((r) => r.type);

  const content: Content[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const section = buildPageSection(exportSheet, chunks[i], i === 0, rowTypes);
    if (i > 0) {
      // pageBreak en el primer elemento de la sección para forzar nueva página.
      (section[0] as unknown as Record<string, unknown>).pageBreak = "before";
    }
    content.push(...section);
  }

  const docDef: TDocumentDefinitions = {
    pageSize: "LETTER",
    pageOrientation: "portrait",
    pageMargins: [40, 50, 40, 50],

    footer: (_currentPage: number, _pageCount: number): Content =>
      ({
        columns: [
          {
            text: `Generado: ${generatedAt}`,
            fontSize: BASE_FONT_SIZES.footer,
            color: STYLE.textMuted,
            margin: [40, 0, 0, 0],
          },
          {
            text: `${_currentPage} / ${_pageCount}`,
            fontSize: BASE_FONT_SIZES.footer,
            color: STYLE.textMuted,
            alignment: "right",
            margin: [0, 0, 40, 0],
          },
        ],
      }) as Content,

    defaultStyle: {
      font: "Roboto",
      fontSize: BODY_FONT_SIZE,
      color: STYLE.text,
    },

    content,
  };

  return docDef;
}

// ── Funciones públicas de export ──

/**
 * Genera el Balance General como Buffer PDF.
 *
 * @param bs  Resultado de `generateBalanceSheet` (con Decimals)
 * @param org Metadata de organización (name, nit, address) para el encabezado ejecutivo
 * @returns   Buffer con el PDF generado
 */
export async function exportBalanceSheetPdf(
  bs: BalanceSheet,
  org: OrgHeaderMetadata,
): Promise<Buffer> {
  registerFonts();
  const exportSheet = buildBalanceSheetExportSheet(bs, org);
  const docDef = buildDocDefinition(exportSheet);
  return pdfmakeRuntime.createPdf(docDef).getBuffer();
}

/**
 * Genera el Estado de Resultados como Buffer PDF.
 *
 * @param is  Resultado de `generateIncomeStatement` (con Decimals)
 * @param org Metadata de organización (name, nit, address) para el encabezado ejecutivo
 * @returns   Buffer con el PDF generado
 */
export async function exportIncomeStatementPdf(
  is: IncomeStatement,
  org: OrgHeaderMetadata,
): Promise<Buffer> {
  registerFonts();
  const exportSheet = buildIncomeStatementExportSheet(is, org);
  const docDef = buildDocDefinition(exportSheet);
  return pdfmakeRuntime.createPdf(docDef).getBuffer();
}
