// Exporter de PDF usando pdfmake con fuentes Roboto bundled.
// Funciones puras: reciben datos ya calculados → retornan Promise<Buffer>.
// Sin Prisma, sin Clerk, sin acceso al sistema de archivos.
//
// QB-style portrait + chunking horizontal para multi-col.
//
// Staircase BCB-style: los saldos de `subtotal` se absorben en el `header-subtype`
// anterior y los de `total` se absorben en el `header-section` anterior (filas
// redundantes omitidas en el PDF). Implementado vía `absorbStaircase` — el builder
// y el Excel quedan intactos. En single-col, eso se materializa en 3 columnas
// físicas escalonadas (detalle / subtotal / total). En multi-col, los headers
// llevan saldo en sus celdas de valor en vez de full-span. Grand-totals que no
// se absorben (TOTAL PASIVO + PATRIMONIO, UTILIDAD NETA, Utilidad Operativa)
// quedan como filas standalone con saldo en la columna más derecha.

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

const BASE_FONT_SIZES = {
  title: 18,           // BALANCE GENERAL / ESTADO DE RESULTADOS — centrado
  orgInfo: 8,          // Empresa + NIT/Dirección — chico, alineado a la derecha (membrete)
  subtitle: 10,        // Fecha "Al ..." + (Expresado en ...)
  footer: 8,           // Generado: dd/mm/yyyy + N / M
} as const;

// ── Pre-procesamiento staircase ──

/**
 * Pre-procesa filas para el layout staircase:
 *
 * - `subtotal` → ABSORBE en el `header-subtype` anterior y omite la fila subtotal.
 *   (Patrimonio Capital muestra su saldo al lado; "Total Patrimonio Capital" no
 *   se renderiza por redundante.)
 *
 * - `total`   → COPIA el saldo en el `header-section` anterior PERO MANTIENE la
 *   fila total como standalone. (ACTIVO muestra 7500.00 al lado, y debajo de
 *   las cuentas aparece "T O T A L  A C T I V O 7500.00" como cierre formal.)
 *   Si no hay header-section pendiente, el total queda standalone tal cual
 *   (ej. TOTAL PASIVO + PATRIMONIO, UTILIDAD NETA).
 *
 * Función pura — clona los headers absorbedores para mutar sus saldos.
 */
function absorbStaircase(rows: ExportRow[]): ExportRow[] {
  const out: ExportRow[] = [];
  let pendingSection: ExportRow | null = null;
  let pendingSubtype: ExportRow | null = null;

  for (const row of rows) {
    switch (row.type) {
      case "header-section": {
        const clone: ExportRow = { ...row };
        out.push(clone);
        pendingSection = clone;
        pendingSubtype = null;
        break;
      }
      case "header-subtype": {
        const clone: ExportRow = { ...row };
        out.push(clone);
        pendingSubtype = clone;
        break;
      }
      case "subtotal":
        if (pendingSubtype) {
          pendingSubtype.balance = row.balance;
          pendingSubtype.balances = row.balances;
          pendingSubtype = null;
        } else {
          out.push(row); // standalone (ej. Utilidad Operativa entre secciones)
        }
        break;
      case "total":
        if (pendingSection) {
          // Copy (no absorb): header-section también muestra el total.
          pendingSection.balance = row.balance;
          pendingSection.balances = row.balances;
          pendingSection = null;
        }
        out.push(row); // siempre se mantiene como fila de cierre
        break;
      default:
        out.push(row);
    }
  }

  return out;
}

/**
 * Aplica letter-spacing emulado intercalando espacios entre cada letra y doble
 * espacio entre palabras. Reservado para banners (header-section) y grand-totals
 * por sección (TOTAL ACTIVO, etc.) — estilo balance bancario boliviano.
 *
 * Ejemplo: "TOTAL ACTIVO" → "T O T A L   A C T I V O"
 */
function spaceLetters(text: string): string {
  return text
    .split(" ")
    .map((word) => word.split("").join(" "))
    .join("   ");
}

// ── Helpers de construcción ──

/**
 * Anchos de columna para la tabla pdfmake.
 *
 * Multi-col: [nombre*, val1, val2, ..., valN]
 * Single-col staircase: [nombre*, colDetalle(80), colSubtotal(80), colTotal(110)]
 *   - El código de cuenta se renderiza inline al lado del nombre (entre paréntesis)
 *     para liberar el espacio que antes ocupaba la columna "Código".
 */
function buildColumnWidths(valueColumns: ExportColumn[]): (string | number)[] {
  if (valueColumns.length > 1) {
    const numCols = valueColumns.length;
    const valWidth = Math.min(95, Math.max(60, Math.floor(420 / numCols)));
    return ["*", ...valueColumns.map(() => valWidth)];
  }
  return ["*", 80, 80, 110];
}

/** Total de columnas en la tabla pdfmake. */
function totalPdfCols(valueColumns: ExportColumn[]): number {
  return valueColumns.length > 1
    ? 1 + valueColumns.length
    : 4; // staircase: nombre + 3 columnas de saldo escalonadas
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

/**
 * pdfmake bug: cuando el layout outer define `hLineWidth: () => 0`, los
 * `cell.border` top quedan suprimidos también (la regla global gana sobre la
 * cell-level). Para dibujar una línea horizontal SOLO bajo la columna del
 * saldo (estilo BCB), envolvemos el saldo en una nested table de 1×1 cuyo
 * layout dibuja su propia hLine en i=0 (encima del contenido).
 */
function wrapWithTopBorder(content: Record<string, unknown>): Content {
  return {
    table: {
      widths: ["*"],
      body: [[content as unknown as Content]],
    },
    layout: {
      hLineWidth: (i: number) => (i === 0 ? 0.5 : 0),
      vLineWidth: () => 0,
      hLineColor: () => STYLE.border,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
  } as unknown as Content;
}

/** Celdas de valor para una fila multi-columna. */
function buildValueCells(
  row: ExportRow,
  valueColumns: ExportColumn[],
  opts: { bold?: boolean; borderTop?: boolean } = {},
): Content[] {
  return valueColumns.map((col) => {
    const val = row.balances?.[col.id] ?? row.balance ?? "";
    const inner: Record<string, unknown> = {
      text: val,
      fontSize: BODY_FONT_SIZE,
      alignment: "right",
      margin: [2, opts.borderTop ? 3 : 1, 4, 1],
    };
    if (opts.bold) inner.bold = true;
    return opts.borderTop ? wrapWithTopBorder(inner) : (inner as unknown as Content);
  });
}

/**
 * Construye una celda de saldo derecha-alineada con configuración estándar.
 * Si `borderTop=true`, envuelve la celda en una nested table que dibuja una
 * línea horizontal SÓLO bajo esta columna (no a lo largo de toda la fila).
 */
function buildSaldoCell(
  value: string | undefined,
  opts: { bold?: boolean; fontSize?: number; borderTop?: boolean },
): Content {
  const inner: Record<string, unknown> = {
    text: value ?? "",
    bold: opts.bold === true,
    fontSize: opts.fontSize ?? BODY_FONT_SIZE,
    color: STYLE.text,
    alignment: "right",
    margin: [2, opts.borderTop ? 3 : 2, 4, 2],
  };
  return opts.borderTop ? wrapWithTopBorder(inner) : (inner as unknown as Content);
}

/** Celda vacía para layouts escalonados. */
function emptyCell(): Content {
  return { text: "" } as Content;
}

/** Devuelve true si la fila tiene saldo absorbido (post-staircase). */
function hasBalance(row: ExportRow): boolean {
  if (row.balance !== undefined && row.balance !== "") return true;
  if (row.balances && Object.keys(row.balances).length > 0) {
    return Object.values(row.balances).some((v) => v !== undefined && v !== "");
  }
  return false;
}

/**
 * Devuelve el índice de columna escalonada (0=detalle, 1=subtotal, 2=total)
 * según el tipo de fila en single-col staircase. account=0, subtype=1, section/total=2.
 */
function staircaseColumn(rowType: ExportRowType): 0 | 1 | 2 {
  if (rowType === "account") return 0;
  if (rowType === "header-subtype" || rowType === "subtotal") return 1;
  return 2; // header-section, total
}

/**
 * Convierte una ExportRow en fila de tabla pdfmake.
 *
 * Single-col: 4 columnas físicas [nombre*, detalle, subtotal, total].
 *   - account → saldo en col detalle (0). Código inline al lado del nombre.
 *   - header-subtype con saldo → saldo en col subtotal (1), bold.
 *   - header-section con saldo → saldo en col total (2), bold + tamaño +1.
 *   - total/subtotal standalone (post-staircase) → saldo en col total (2), bold.
 *   - imbalance → full-span rojo.
 *
 * Multi-col: nombre* + N columnas de valor (idéntico al actual). Los headers
 * (subtype/section) ahora llevan saldo en sus celdas de valor cuando vienen
 * absorbidos por staircase — sin full-span.
 */
function rowToTableRow(
  row: ExportRow,
  valueColumns: ExportColumn[],
): Content[] {
  const isMultiCol = valueColumns.length > 1;
  const totalCols = totalPdfCols(valueColumns);
  const marginLeft = row.indent * 8;

  // imbalance siempre es full-span en rojo
  if (row.type === "imbalance") {
    return buildFullSpanRow(row.label, BODY_FONT_SIZE, true, STYLE.danger, row.indent, totalCols);
  }

  // ── MULTI-COL ──
  if (isMultiCol) {
    if (row.type === "header-section") {
      // ACTIVO/PASIVO/PATRIMONIO con saldo al lado (post-staircase copy)
      const labelUpper = row.label.toUpperCase();
      const nameCell: Content = {
        text: labelUpper,
        bold: true,
        fontSize: BODY_FONT_SIZE + 1,
        color: STYLE.text,
        margin: [marginLeft + 4, 4, 4, 4],
      };
      if (hasBalance(row)) {
        return [nameCell, ...buildValueCells(row, valueColumns, { bold: true })];
      }
      return buildFullSpanRow(labelUpper, BODY_FONT_SIZE + 1, true, STYLE.text, row.indent, totalCols);
    }

    if (row.type === "header-subtype") {
      const labelUpper = row.label.toUpperCase();
      const nameCell: Content = {
        text: labelUpper,
        bold: true,
        fontSize: BODY_FONT_SIZE,
        color: STYLE.text,
        margin: [marginLeft + 4, 2, 4, 2],
      };
      if (hasBalance(row)) {
        return [nameCell, ...buildValueCells(row, valueColumns, { bold: true })];
      }
      return buildFullSpanRow(labelUpper, BODY_FONT_SIZE, true, STYLE.text, row.indent, totalCols);
    }

    if (row.type === "account") {
      const nameCell: Content = {
        text: row.label.toUpperCase(),
        fontSize: BODY_FONT_SIZE,
        color: STYLE.text,
        margin: [marginLeft + 4, 0, 4, 0],
      };
      return [nameCell, ...buildValueCells(row, valueColumns)];
    }

    // total — TOTAL ACTIVO/PASIVO/etc con tipografía espaciada + línea encima
    // del saldo (no a lo ancho).
    if (row.type === "total") {
      const nameCell: Content = {
        text: spaceLetters(row.label),
        bold: true,
        fontSize: BODY_FONT_SIZE,
        color: STYLE.text,
        margin: [marginLeft + 4, 6, 4, 6],
      };
      return [nameCell, ...buildValueCells(row, valueColumns, { bold: true, borderTop: true })];
    }

    // subtotal standalone (ej. Utilidad Operativa) — bold normal + línea encima del saldo
    const nameCell: Content = {
      text: row.label.toUpperCase(),
      bold: true,
      fontSize: BODY_FONT_SIZE,
      color: STYLE.text,
      margin: [marginLeft + 4, 4, 4, 4],
    };
    return [nameCell, ...buildValueCells(row, valueColumns, { bold: true, borderTop: true })];
  }

  // ── SINGLE-COL STAIRCASE (4 columnas físicas) ──
  // Render: [nombre, detalle, subtotal, total]. La columna que lleva el saldo
  // depende del tipo (staircaseColumn). Las otras dos van vacías.
  const saldoCol = staircaseColumn(row.type);

  const isSection = row.type === "header-section";
  const isTotalSection = row.type === "total"; // TOTAL ACTIVO / TOTAL PASIVO / etc.
  const isSubtotalStandalone = row.type === "subtotal"; // Utilidad Operativa
  const isHeader = row.type === "header-section" || row.type === "header-subtype";

  // Texto del nombre:
  //   - account → "{CÓDIGO}  {NOMBRE}" en MAYÚS
  //   - header-subtype → MAYÚS plano (Activo Corriente → ACTIVO CORRIENTE)
  //   - header-section → MAYÚS plano (ACTIVO, PASIVO, PATRIMONIO) con saldo al lado
  //   - total → letter-spaced ("T O T A L   A C T I V O") como cierre formal
  //   - resto (subtotal standalone) → tal cual
  let nameText: string;
  if (row.type === "account") {
    nameText = row.code
      ? `${row.code}  ${row.label.toUpperCase()}`
      : row.label.toUpperCase();
  } else if (row.type === "header-subtype" || isSection) {
    nameText = row.label.toUpperCase();
  } else if (isTotalSection) {
    nameText = spaceLetters(row.label);
  } else if (isSubtotalStandalone) {
    nameText = row.label.toUpperCase();
  } else {
    nameText = row.label;
  }

  // Padding vertical: cuentas individuales casi sin separación, banners y
  // grand-totals con respiro generoso.
  const padTopBottom = isSection
    ? 6
    : isTotalSection
      ? 6
      : isSubtotalStandalone
        ? 4
        : row.type === "header-subtype"
          ? 3
          : 0; // account

  const nameFontSize = isSection ? BODY_FONT_SIZE + 1 : BODY_FONT_SIZE;
  const nameBold = isHeader || isTotalSection || isSubtotalStandalone;

  const nameCell: Content = {
    text: nameText,
    bold: nameBold,
    fontSize: nameFontSize,
    color: STYLE.text,
    margin: [marginLeft + 4, padTopBottom, 4, padTopBottom],
  };

  const saldoText = row.balance ?? "";
  const saldoBold = nameBold;
  const saldoSize = isSection ? BODY_FONT_SIZE + 1 : BODY_FONT_SIZE;
  // Línea encima del saldo SOLO en filas total/subtotal standalone (estilo BCB —
  // la línea no se extiende a lo largo de toda la fila, solo bajo el número).
  const saldoBorderTop = isTotalSection || isSubtotalStandalone;

  // Si la fila no tiene saldo, las 3 cols de saldo quedan vacías.
  const saldoCellOrEmpty = hasBalance(row)
    ? buildSaldoCell(saldoText, { bold: saldoBold, fontSize: saldoSize, borderTop: saldoBorderTop })
    : emptyCell();

  return [
    nameCell,
    saldoCol === 0 ? saldoCellOrEmpty : emptyCell(),
    saldoCol === 1 ? saldoCellOrEmpty : emptyCell(),
    saldoCol === 2 ? saldoCellOrEmpty : emptyCell(),
  ];
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
  stairRows: ExportRow[],
): Content[] {
  // Sin fila de encabezado de columnas — el contexto ("Saldo BOB") lo da el
  // subtítulo "(Expresado en Bolivianos)" y la jerarquía visual del staircase.
  const tableBody: Content[][] = [];
  for (const row of stairRows) {
    tableBody.push(rowToTableRow(row, valueColumns));
  }

  // Layout sin líneas horizontales globales — los bordes se aplican
  // selectivamente a cada celda de saldo en total/subtotal (estilo BCB).
  const layout = {
    hLineWidth: () => 0,
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
        headerRows: 0,
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

  // Pre-procesar staircase UNA vez — usado por todas las page sections.
  const stairRows = absorbStaircase(exportSheet.rows);

  const content: Content[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const section = buildPageSection(exportSheet, chunks[i], i === 0, stairRows);
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
