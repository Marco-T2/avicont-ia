// Exporter de Excel usando exceljs.
// Funciones puras: reciben datos ya calculados → retornan Promise<Buffer>.
// Sin Prisma, sin Clerk, sin acceso al sistema de archivos.
//
// PR4: soporte multi-columna.
// PR4.2: estilo QuickBooks — Arial, sin rellenos, indent nativo, bordes horizontales.
// - Encabezado de columnas dinámico (N columnas de valor)
// - Celdas numéricas NATIVAS (cell.value = number, cell.numFmt = FORMAT)
// - Congelado: primera columna (xSplit:1) + filas de encabezado (ySplit:N)
// - worksheet.views: [{ state: "frozen", xSplit: 1, ySplit: frozenRows }]

import ExcelJS from "exceljs";
import type { ExportColumn, ExportRow, ExportSheet } from "./statement-shape";
import {
  buildBalanceSheetExportSheet,
  buildIncomeStatementExportSheet,
  type OrgHeaderMetadata,
} from "./sheet.builder";
import type { BalanceSheet, IncomeStatement } from "../../domain/types/financial-statements.types";

// ── Constantes de estilo (QB-style: sin colores de fondo) ──

const STYLE = {
  text: "000000",
  textMuted: "6B7280",
  border: "000000",
  borderLight: "D1D5DB",
  danger: "B91C1C",
} as const;

// Formato numérico para saldos BOB (negativo entre paréntesis)
const NUMBER_FORMAT = "#,##0.00;(#,##0.00)";

// ── Helpers ──

function arial(opts: {
  bold?: boolean;
  size?: number;
  color?: string;
  italic?: boolean;
}): Partial<ExcelJS.Font> {
  return {
    name: "Arial",
    bold: opts.bold ?? false,
    italic: opts.italic ?? false,
    size: opts.size ?? 8,
    color: { argb: opts.color ?? STYLE.text },
  };
}

function thinTop(): Partial<ExcelJS.Borders> {
  return {
    top: { style: "thin", color: { argb: STYLE.border } },
  };
}

function thinTopBottom(): Partial<ExcelJS.Borders> {
  return {
    top: { style: "thin", color: { argb: STYLE.border } },
    bottom: { style: "thin", color: { argb: STYLE.border } },
  };
}

/**
 * Número de la última columna Excel para un ExportSheet.
 * Estructura: A=nombre, B=código (single-col), B..? = valores (multi-col).
 */
function lastExcelCol(valueColumns: ExportColumn[]): string {
  const totalCols = valueColumns.length > 1
    ? 1 + valueColumns.length   // nombre + N valores
    : 3;                         // nombre + código + saldo
  let result = "";
  let n = totalCols;
  while (n > 0) {
    n--;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

// ── Construcción de la hoja de cálculo ──

/**
 * Escribe el encabezado del documento (organización, título, fecha, columnas).
 *
 * Estructura ejecutiva (paralela al PDF, estilo membrete — datos a la izquierda,
 * cada campo en su propia fila):
 *   Empresa: {orgName}                    (bold, izquierda, 8pt)
 *   NIT: {nit}                            (izquierda, 8pt) — opcional
 *   Dirección: {address}                  (izquierda, 8pt) — opcional
 *   {city}                                (izquierda, 8pt) — opcional
 *   {TÍTULO EN CAPS}                      (bold, grande, centrado)
 *   {subtitle / período}                  (centrado)
 *   (Expresado en Bolivianos)             (italic, centrado)
 *   <fila vacía>
 *   <encabezados de columna>
 *
 * Las filas opcionales se omiten cuando el campo está vacío; el número total
 * de filas varía y `frozenRows` se deriva dinámicamente del rowNum resultante.
 *
 * Retorna el número de la última fila escrita (la fila de encabezados de columna).
 */
function writeDocumentHeader(
  sheet: ExcelJS.Worksheet,
  exportSheet: ExportSheet,
): number {
  const valueColumns = exportSheet.columns;
  const isMultiCol = valueColumns.length > 1;
  const lastCol = lastExcelCol(valueColumns);
  let rowNum = 1;

  // Líneas de identidad organizacional — una por fila (membrete), izquierda.
  // Graceful omission por campo: si está vacío, no se emite la fila.
  const pushOrgRow = (text: string, bold = false) => {
    const r = sheet.getRow(rowNum);
    const c = r.getCell(1);
    c.value = text;
    c.font = arial({ bold, size: 8 });
    c.alignment = { horizontal: "left" };
    sheet.mergeCells(`A${rowNum}:${lastCol}${rowNum}`);
    rowNum++;
  };

  pushOrgRow(`Empresa: ${exportSheet.orgName}`, true);
  if (exportSheet.orgNit && exportSheet.orgNit.trim().length > 0) {
    pushOrgRow(`NIT: ${exportSheet.orgNit}`);
  }
  if (exportSheet.orgAddress && exportSheet.orgAddress.trim().length > 0) {
    pushOrgRow(`Dirección: ${exportSheet.orgAddress}`);
  }
  if (exportSheet.orgCity && exportSheet.orgCity.trim().length > 0) {
    pushOrgRow(exportSheet.orgCity);
  }

  // Título en CAPS
  const titleRow = sheet.getRow(rowNum);
  const titleCell = titleRow.getCell(1);
  titleCell.value = exportSheet.title.toUpperCase();
  titleCell.font = arial({ bold: true, size: 14 });
  titleCell.alignment = { horizontal: "center" };
  sheet.mergeCells(`A${rowNum}:${lastCol}${rowNum}`);
  rowNum++;

  // Subtítulo / período
  const dateRow = sheet.getRow(rowNum);
  const dateCell = dateRow.getCell(1);
  dateCell.value = exportSheet.subtitle;
  dateCell.font = arial({ size: 10 });
  dateCell.alignment = { horizontal: "center" };
  sheet.mergeCells(`A${rowNum}:${lastCol}${rowNum}`);
  rowNum++;

  // (Expresado en Bolivianos)
  const currencyRow = sheet.getRow(rowNum);
  const currencyCell = currencyRow.getCell(1);
  currencyCell.value = "(Expresado en Bolivianos)";
  currencyCell.font = arial({ size: 10, italic: true });
  currencyCell.alignment = { horizontal: "center" };
  sheet.mergeCells(`A${rowNum}:${lastCol}${rowNum}`);
  rowNum++;

  // Fila vacía de separación
  rowNum++;

  // Encabezados de columna de datos
  const colRow = sheet.getRow(rowNum++);
  const cuentaCell = colRow.getCell(1);
  cuentaCell.value = "Cuenta";
  cuentaCell.font = arial({ bold: true, size: 9 });
  cuentaCell.alignment = { horizontal: "left", vertical: "middle" };
  cuentaCell.border = {
    top: { style: "thin", color: { argb: STYLE.border } },
    bottom: { style: "thin", color: { argb: STYLE.border } },
  };

  if (isMultiCol) {
    valueColumns.forEach((col, i) => {
      const cell = colRow.getCell(i + 2);
      cell.value = col.label;
      cell.font = arial({ bold: true, size: 9 });
      cell.alignment = { horizontal: "right", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: STYLE.border } },
        bottom: { style: "thin", color: { argb: STYLE.border } },
      };
    });
  } else {
    const codeCell = colRow.getCell(2);
    codeCell.value = "Código";
    codeCell.font = arial({ bold: true, size: 9 });
    codeCell.alignment = { horizontal: "center", vertical: "middle" };
    codeCell.border = {
      top: { style: "thin", color: { argb: STYLE.border } },
      bottom: { style: "thin", color: { argb: STYLE.border } },
    };

    const balCell = colRow.getCell(3);
    balCell.value = "Saldo BOB";
    balCell.font = arial({ bold: true, size: 9 });
    balCell.alignment = { horizontal: "right", vertical: "middle" };
    balCell.border = {
      top: { style: "thin", color: { argb: STYLE.border } },
      bottom: { style: "thin", color: { argb: STYLE.border } },
    };
  }

  return rowNum;
}

/**
 * Escribe una celda numérica nativa.
 * Si el string es vacío o no parseable, escribe 0.
 * SIEMPRE usa cell.value = number — nunca string para valores monetarios.
 *
 * Para filas de contra-cuenta (isContra=true):
 *   - El string de `valueStr` puede estar envuelto en paréntesis "(120,000.00)"
 *     porque el sheet.builder lo pre-formatea para el path PDF.
 *   - parseFloat("(120,000.00)") → NaN. La corrección R2: ignorar paréntesis y negar.
 *   - El formato #,##0.00;(#,##0.00) ya renderiza números negativos con paréntesis en Excel.
 *   - Resultado: cell.value = -120000 → Excel muestra (120,000.00). Columna sumable.
 */
function writeNumericCell(
  cell: ExcelJS.Cell,
  valueStr: string | undefined,
  opts: { bold?: boolean; size?: number },
  isContra = false,
): void {
  let value: number;
  if (isContra) {
    // Strip parens if present (e.g. "(120000.00)" → "120000.00"), then negate.
    const stripped = valueStr ? valueStr.replace(/^\((.+)\)$/, "$1") : "0";
    const parsed = parseFloat(stripped);
    value = isNaN(parsed) ? 0 : -Math.abs(parsed);
  } else {
    const parsed = valueStr ? parseFloat(valueStr) : 0;
    value = isNaN(parsed) ? 0 : parsed;
  }
  cell.value = value;
  cell.numFmt = NUMBER_FORMAT;
  cell.font = arial({ bold: opts.bold, size: opts.size ?? 8 });
  cell.alignment = { horizontal: "right" };
}

/**
 * Escribe una fila del ExportSheet en la hoja de cálculo.
 * QB-style: sin rellenos, indent nativo (alignment.indent), bordes horizontales sólo en totales.
 */
function writeExportRow(
  worksheet: ExcelJS.Worksheet,
  row: ExportRow,
  rowNum: number,
  valueColumns: ExportColumn[],
): void {
  const excelRow = worksheet.getRow(rowNum);
  const isMultiCol = valueColumns.length > 1;

  switch (row.type) {
    case "header-section": {
      const cell = excelRow.getCell(1);
      cell.value = row.label;
      cell.font = arial({ bold: true, size: 8 });
      cell.alignment = { horizontal: "left", indent: 0 };
      break;
    }

    case "header-subtype": {
      const cell = excelRow.getCell(1);
      cell.value = row.label;
      cell.font = arial({ bold: true, size: 8 });
      cell.alignment = { horizontal: "left", indent: row.indent };
      break;
    }

    case "account": {
      const labelCell = excelRow.getCell(1);
      labelCell.value = row.label;
      labelCell.font = arial({ size: 8 });
      labelCell.alignment = { horizontal: "left", indent: row.indent };

      const isContraRow = row.isContra === true;

      if (isMultiCol) {
        valueColumns.forEach((col, i) => {
          const val = row.balances?.[col.id] ?? row.balance ?? "";
          writeNumericCell(excelRow.getCell(i + 2), val, {}, isContraRow);
        });
      } else {
        const codeCell = excelRow.getCell(2);
        codeCell.value = row.code ?? "";
        codeCell.font = arial({ size: 8 });
        codeCell.alignment = { horizontal: "center" };

        writeNumericCell(excelRow.getCell(3), row.balance, {}, isContraRow);
      }
      break;
    }

    case "subtotal": {
      const labelCell = excelRow.getCell(1);
      labelCell.value = row.label;
      labelCell.font = arial({ bold: true, size: 8 });
      labelCell.alignment = { horizontal: "left", indent: row.indent };
      labelCell.border = thinTop();

      if (isMultiCol) {
        valueColumns.forEach((col, i) => {
          const val = row.balances?.[col.id] ?? row.balance ?? "";
          const cell = excelRow.getCell(i + 2);
          writeNumericCell(cell, val, { bold: true });
          cell.border = thinTop();
        });
      } else {
        const balCell = excelRow.getCell(3);
        writeNumericCell(balCell, row.balance, { bold: true });
        balCell.border = thinTop();
      }
      break;
    }

    case "total": {
      const labelCell = excelRow.getCell(1);
      labelCell.value = row.label;
      labelCell.font = arial({ bold: true, size: 9 });
      labelCell.alignment = { horizontal: "left", indent: 0 };
      labelCell.border = thinTopBottom();

      if (isMultiCol) {
        valueColumns.forEach((col, i) => {
          const val = row.balances?.[col.id] ?? row.balance ?? "";
          const cell = excelRow.getCell(i + 2);
          writeNumericCell(cell, val, { bold: true, size: 9 });
          cell.border = thinTopBottom();
        });
      } else {
        const balCell = excelRow.getCell(3);
        writeNumericCell(balCell, row.balance, { bold: true, size: 9 });
        balCell.border = thinTopBottom();
      }
      break;
    }

    case "imbalance": {
      const cell = excelRow.getCell(1);
      cell.value = row.label;
      cell.font = arial({ bold: true, size: 8, color: STYLE.danger });
      cell.alignment = { horizontal: "left" };
      break;
    }
  }
}

function writeDocumentFooter(worksheet: ExcelJS.Worksheet, rowNum: number): void {
  const footerRow = worksheet.getRow(rowNum + 2);
  const generatedAt = new Date().toLocaleString("es-BO", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  footerRow.getCell(1).value = `Generado: ${generatedAt}`;
  footerRow.getCell(1).font = arial({ size: 8, italic: true, color: STYLE.textMuted });
}

/**
 * Convierte un ExportSheet en un Workbook de exceljs y retorna Buffer.
 *
 * PR4.2 QB-style:
 * - Orientación portrait siempre
 * - Columnas dinámicas (nombre 42pt + N columnas de valor)
 * - xSplit: 1 (congela columna nombre)
 * - ySplit: frozenRows (congela encabezados de documento + columnas)
 */
async function exportSheetToBuffer(exportSheet: ExportSheet): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Avicont IA";
  workbook.created = new Date();

  const sheetName = exportSheet.title.substring(0, 31);
  const worksheet = workbook.addWorksheet(sheetName, {
    pageSetup: {
      paperSize: 5,
      orientation: "portrait",
      fitToPage: true,
    },
    views: [{ state: "normal" }],
  });

  const valueColumns = exportSheet.columns;
  const isMultiCol = valueColumns.length > 1;

  if (isMultiCol) {
    const valueCols: Partial<ExcelJS.Column>[] = valueColumns.map((col) => ({
      key: col.id,
      width: Math.min(18, Math.max(12, col.label.length * 1.2)),
    }));
    worksheet.columns = [
      { key: "account", width: 42 },
      ...valueCols,
    ] as ExcelJS.Column[];
  } else {
    worksheet.columns = [
      { key: "account", width: 42 },
      { key: "code", width: 14 },
      { key: "balance", width: 16 },
    ] as ExcelJS.Column[];
  }

  let rowNum = writeDocumentHeader(worksheet, exportSheet);

  // Congelar: columna nombre (xSplit:1) + todas las filas del header doc
  // incluyendo los encabezados de columna (en rowNum - 1).
  const frozenRows = rowNum - 1;

  for (const row of exportSheet.rows) {
    writeExportRow(worksheet, row, rowNum, valueColumns);
    rowNum++;
  }

  writeDocumentFooter(worksheet, rowNum);

  worksheet.views = [{ state: "frozen", ySplit: frozenRows, xSplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ── Funciones públicas de export ──

/**
 * Genera el Balance General como Buffer XLSX (Excel).
 *
 * @param bs  Resultado de `generateBalanceSheet` (con Decimals)
 * @param org Metadata de organización (name, nit, address) para el encabezado ejecutivo
 * @returns   Buffer con el archivo XLSX generado
 */
export async function exportBalanceSheetExcel(
  bs: BalanceSheet,
  org: OrgHeaderMetadata,
): Promise<Buffer> {
  const sheet = buildBalanceSheetExportSheet(bs, org);
  return exportSheetToBuffer(sheet);
}

/**
 * Genera el Estado de Resultados como Buffer XLSX (Excel).
 *
 * @param is  Resultado de `generateIncomeStatement` (con Decimals)
 * @param org Metadata de organización (name, nit, address) para el encabezado ejecutivo
 * @returns   Buffer con el archivo XLSX generado
 */
export async function exportIncomeStatementExcel(
  is: IncomeStatement,
  org: OrgHeaderMetadata,
): Promise<Buffer> {
  const sheet = buildIncomeStatementExportSheet(is, org);
  return exportSheetToBuffer(sheet);
}
