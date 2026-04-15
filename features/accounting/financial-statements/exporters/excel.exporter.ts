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
import { buildBalanceSheetExportSheet, buildIncomeStatementExportSheet } from "./sheet.builder";
import type { BalanceSheet, IncomeStatement } from "../financial-statements.types";

// ── Constantes de estilo (QB-style: sin colores de fondo) ──

const STYLE = {
  text: "000000",
  textMuted: "6B7280",
  border: "000000",
  borderLight: "D1D5DB",
  danger: "B91C1C",
  preliminary: "B45309",
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
 * Estructura QB: fila 1=título, fila 2=empresa, fila 3=período, fila 4=PRELIMINAR (opcional),
 * fila 5=vacía, fila 6=encabezados de columna.
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

  // Fila 1: título del estado (ej. "Balance General")
  const titleRow = sheet.getRow(rowNum++);
  const titleCell = titleRow.getCell(1);
  titleCell.value = exportSheet.title;
  titleCell.font = arial({ bold: true, size: 14 });
  titleCell.alignment = { horizontal: "center" };
  sheet.mergeCells(`A1:${lastCol}1`);

  // Fila 2: nombre de la organización
  const orgRow = sheet.getRow(rowNum++);
  const orgCell = orgRow.getCell(1);
  orgCell.value = exportSheet.orgName;
  orgCell.font = arial({ bold: true, size: 12 });
  orgCell.alignment = { horizontal: "center" };
  sheet.mergeCells(`A2:${lastCol}2`);

  // Fila 3: rango de fechas / fecha de corte
  const dateRow = sheet.getRow(rowNum++);
  const dateCell = dateRow.getCell(1);
  dateCell.value = exportSheet.subtitle;
  dateCell.font = arial({ size: 10 });
  dateCell.alignment = { horizontal: "center" };
  sheet.mergeCells(`A3:${lastCol}3`);

  // Fila 4: aviso PRELIMINAR si aplica
  if (exportSheet.preliminary) {
    const prelRow = sheet.getRow(rowNum++);
    const prelCell = prelRow.getCell(1);
    prelCell.value = "ESTADO PRELIMINAR — basado en datos no confirmados";
    prelCell.font = arial({ bold: true, size: 9, color: STYLE.preliminary });
    prelCell.alignment = { horizontal: "center" };
    sheet.mergeCells(`A${rowNum - 1}:${lastCol}${rowNum - 1}`);
  }

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
 */
function writeNumericCell(
  cell: ExcelJS.Cell,
  valueStr: string | undefined,
  opts: { bold?: boolean; size?: number },
): void {
  const parsed = valueStr ? parseFloat(valueStr) : 0;
  cell.value = isNaN(parsed) ? 0 : parsed;
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

      if (isMultiCol) {
        valueColumns.forEach((col, i) => {
          const val = row.balances?.[col.id] ?? row.balance ?? "";
          writeNumericCell(excelRow.getCell(i + 2), val, {});
        });
      } else {
        const codeCell = excelRow.getCell(2);
        codeCell.value = row.code ?? "";
        codeCell.font = arial({ size: 8 });
        codeCell.alignment = { horizontal: "center" };

        writeNumericCell(excelRow.getCell(3), row.balance, {});
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

  for (const row of exportSheet.rows) {
    writeExportRow(worksheet, row, rowNum, valueColumns);
    rowNum++;
  }

  writeDocumentFooter(worksheet, rowNum);

  // Congelar: columna nombre (xSplit:1) + filas de encabezado doc (ySplit)
  // Estructura: fila 1=título, 2=empresa, 3=período, [4=PRELIMINAR], 5=vacía, 6=col-headers
  const frozenRows = exportSheet.preliminary ? 6 : 5;
  worksheet.views = [{ state: "frozen", ySplit: frozenRows, xSplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ── Funciones públicas de export ──

/**
 * Genera el Balance General como Buffer XLSX (Excel).
 *
 * @param bs      Resultado de `generateBalanceSheet` (con Decimals)
 * @param orgName Nombre de la organización para el encabezado
 * @returns       Buffer con el archivo XLSX generado
 */
export async function exportBalanceSheetExcel(bs: BalanceSheet, orgName: string): Promise<Buffer> {
  const sheet = buildBalanceSheetExportSheet(bs, orgName);
  return exportSheetToBuffer(sheet);
}

/**
 * Genera el Estado de Resultados como Buffer XLSX (Excel).
 *
 * @param is      Resultado de `generateIncomeStatement` (con Decimals)
 * @param orgName Nombre de la organización para el encabezado
 * @returns       Buffer con el archivo XLSX generado
 */
export async function exportIncomeStatementExcel(
  is: IncomeStatement,
  orgName: string,
): Promise<Buffer> {
  const sheet = buildIncomeStatementExportSheet(is, orgName);
  return exportSheetToBuffer(sheet);
}
