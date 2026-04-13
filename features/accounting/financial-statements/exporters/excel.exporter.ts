// Exporter de Excel usando exceljs.
// Funciones puras: reciben datos ya calculados → retornan Promise<Buffer>.
// Sin Prisma, sin Clerk, sin acceso al sistema de archivos.

import ExcelJS from "exceljs";
import type { ExportRow, ExportSheet } from "./statement-shape";
import { buildBalanceSheetExportSheet, buildIncomeStatementExportSheet } from "./sheet.builder";
import type { BalanceSheet, IncomeStatement } from "../financial-statements.types";

// ── Constantes de estilo ──

const COLORS = {
  headerBg: "1E3A5F",   // Azul marino — encabezado de documento
  headerFg: "FFFFFF",
  sectionBg: "2D6A9F",  // Azul medio — encabezado de sección
  sectionFg: "FFFFFF",
  subtypeBg: "DCE6F1",  // Azul claro — encabezado de subtipo
  subtypeFg: "1E3A5F",
  totalBg: "F0F0F0",    // Gris claro — filas de total
  totalFg: "1E3A5F",
  imbalanceBg: "FFCCCC", // Rojo claro — desbalance
  imbalanceFg: "CC0000",
  bodyFg: "333333",
  borderColor: "CCCCCC",
  preliminaryFg: "CC8800", // Naranja — texto PRELIMINAR
} as const;

// Formato numérico para saldos BOB (negativo entre paréntesis)
const NUMBER_FORMAT = "#,##0.00;(#,##0.00)";

// ── Helpers ──

/** Crea un estilo de relleno sólido a partir de un código ARGB. */
function solidFill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

/** Crea un borde fino estándar. */
function thinBorder(): Partial<ExcelJS.Borders> {
  return {
    bottom: { style: "thin", color: { argb: COLORS.borderColor } },
  };
}

/** Crea una fuente con estilo. */
function font(opts: { bold?: boolean; color?: string; size?: number; italic?: boolean }): Partial<ExcelJS.Font> {
  return {
    name: "Calibri",
    bold: opts.bold ?? false,
    italic: opts.italic ?? false,
    size: opts.size ?? 10,
    color: { argb: opts.color ?? COLORS.bodyFg },
  };
}

// ── Construcción de la hoja de cálculo ──

/**
 * Escribe el encabezado del documento (organización, título, fecha).
 * Retorna el número de la última fila escrita.
 */
function writeDocumentHeader(sheet: ExcelJS.Worksheet, exportSheet: ExportSheet): number {
  let rowNum = 1;

  // Fila 1: nombre de la organización
  const orgRow = sheet.getRow(rowNum++);
  const orgCell = orgRow.getCell(1);
  orgCell.value = exportSheet.orgName;
  orgCell.font = font({ bold: true, size: 12, color: COLORS.headerFg });
  orgCell.fill = solidFill(COLORS.headerBg);
  orgCell.alignment = { horizontal: "center", vertical: "middle" };
  orgRow.height = 22;
  sheet.mergeCells(`A1:C1`);

  // Fila 2: título del estado
  const titleRow = sheet.getRow(rowNum++);
  const titleCell = titleRow.getCell(1);
  titleCell.value = exportSheet.title;
  titleCell.font = font({ bold: true, size: 11, color: COLORS.headerFg });
  titleCell.fill = solidFill(COLORS.headerBg);
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleRow.height = 20;
  sheet.mergeCells(`A2:C2`);

  // Fila 3: rango de fechas / fecha de corte
  const dateRow = sheet.getRow(rowNum++);
  const dateCell = dateRow.getCell(1);
  dateCell.value = exportSheet.subtitle;
  dateCell.font = font({ size: 10, color: COLORS.headerFg });
  dateCell.fill = solidFill(COLORS.sectionBg);
  dateCell.alignment = { horizontal: "center", vertical: "middle" };
  dateRow.height = 18;
  sheet.mergeCells(`A3:C3`);

  // Fila 4: aviso PRELIMINAR si aplica
  if (exportSheet.preliminary) {
    const prelRow = sheet.getRow(rowNum++);
    const prelCell = prelRow.getCell(1);
    prelCell.value = "ESTADO PRELIMINAR — basado en datos no confirmados";
    prelCell.font = font({ bold: true, size: 9, color: COLORS.preliminaryFg });
    prelCell.alignment = { horizontal: "center", vertical: "middle" };
    prelRow.height = 16;
    sheet.mergeCells(`A${rowNum - 1}:C${rowNum - 1}`);
  }

  // Fila vacía de separación
  rowNum++;

  // Encabezados de columna
  const colRow = sheet.getRow(rowNum++);
  const headers = ["Cuenta", "Código", "Saldo BOB"];
  const aligns: ExcelJS.Alignment["horizontal"][] = ["left", "center", "right"];
  headers.forEach((h, i) => {
    const cell = colRow.getCell(i + 1);
    cell.value = h;
    cell.font = font({ bold: true, size: 9, color: COLORS.subtypeFg });
    cell.fill = solidFill(COLORS.subtypeBg);
    cell.alignment = { horizontal: aligns[i], vertical: "middle" };
    cell.border = thinBorder();
  });
  colRow.height = 16;

  return rowNum;
}

/**
 * Escribe una fila del ExportSheet en la hoja de cálculo.
 */
function writeExportRow(
  worksheet: ExcelJS.Worksheet,
  row: ExportRow,
  rowNum: number,
): void {
  const excelRow = worksheet.getRow(rowNum);
  const indentSpaces = "  ".repeat(row.indent);

  switch (row.type) {
    case "header-section": {
      const cell = excelRow.getCell(1);
      cell.value = row.label;
      cell.font = font({ bold: true, size: 9, color: COLORS.sectionFg });
      cell.fill = solidFill(COLORS.sectionBg);
      cell.alignment = { horizontal: "left", vertical: "middle", indent: row.indent };
      excelRow.getCell(2).fill = solidFill(COLORS.sectionBg);
      excelRow.getCell(3).fill = solidFill(COLORS.sectionBg);
      excelRow.height = 18;
      worksheet.mergeCells(`A${rowNum}:C${rowNum}`);
      break;
    }

    case "header-subtype": {
      const cell = excelRow.getCell(1);
      cell.value = `${indentSpaces}${row.label}`;
      cell.font = font({ bold: true, size: 9, color: COLORS.subtypeFg });
      cell.fill = solidFill(COLORS.subtypeBg);
      excelRow.getCell(2).fill = solidFill(COLORS.subtypeBg);
      excelRow.getCell(3).fill = solidFill(COLORS.subtypeBg);
      excelRow.height = 16;
      worksheet.mergeCells(`A${rowNum}:C${rowNum}`);
      break;
    }

    case "account": {
      const labelCell = excelRow.getCell(1);
      labelCell.value = `${indentSpaces}${row.label}`;
      labelCell.font = font({ size: 9 });

      const codeCell = excelRow.getCell(2);
      codeCell.value = row.code ?? "";
      codeCell.font = font({ size: 9 });
      codeCell.alignment = { horizontal: "center" };

      const balCell = excelRow.getCell(3);
      // Saldo como número para que Excel aplique formato numérico
      balCell.value = row.balance ? parseFloat(row.balance) : 0;
      balCell.numFmt = NUMBER_FORMAT;
      balCell.font = font({ size: 9 });
      balCell.alignment = { horizontal: "right" };
      excelRow.height = 14;
      break;
    }

    case "subtotal": {
      const labelCell = excelRow.getCell(1);
      labelCell.value = `${indentSpaces}${row.label}`;
      labelCell.font = font({ bold: true, size: 9 });
      labelCell.fill = solidFill(COLORS.totalBg);
      labelCell.border = { top: { style: "thin", color: { argb: COLORS.headerBg } } };

      excelRow.getCell(2).fill = solidFill(COLORS.totalBg);

      const balCell = excelRow.getCell(3);
      balCell.value = row.balance ? parseFloat(row.balance) : 0;
      balCell.numFmt = NUMBER_FORMAT;
      balCell.font = font({ bold: true, size: 9 });
      balCell.fill = solidFill(COLORS.totalBg);
      balCell.alignment = { horizontal: "right" };
      balCell.border = { top: { style: "thin", color: { argb: COLORS.headerBg } } };
      excelRow.height = 15;
      break;
    }

    case "total": {
      const labelCell = excelRow.getCell(1);
      labelCell.value = row.label;
      labelCell.font = font({ bold: true, size: 9, color: COLORS.headerFg });
      labelCell.fill = solidFill(COLORS.headerBg);
      labelCell.alignment = { horizontal: "left", vertical: "middle" };

      excelRow.getCell(2).fill = solidFill(COLORS.headerBg);

      const balCell = excelRow.getCell(3);
      balCell.value = row.balance ? parseFloat(row.balance) : 0;
      balCell.numFmt = NUMBER_FORMAT;
      balCell.font = font({ bold: true, size: 9, color: COLORS.headerFg });
      balCell.fill = solidFill(COLORS.headerBg);
      balCell.alignment = { horizontal: "right" };
      excelRow.height = 16;
      break;
    }

    case "imbalance": {
      const cell = excelRow.getCell(1);
      cell.value = row.label;
      cell.font = font({ bold: true, size: 9, color: COLORS.imbalanceFg });
      cell.fill = solidFill(COLORS.imbalanceBg);
      excelRow.getCell(2).fill = solidFill(COLORS.imbalanceBg);
      excelRow.getCell(3).fill = solidFill(COLORS.imbalanceBg);
      excelRow.height = 16;
      worksheet.mergeCells(`A${rowNum}:C${rowNum}`);
      break;
    }
  }
}

/**
 * Escribe el pie del documento (timestamp de generación).
 */
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
  footerRow.getCell(1).font = font({ size: 8, italic: true, color: "888888" });
}

/**
 * Convierte un ExportSheet en un Workbook de exceljs y retorna Buffer.
 */
async function exportSheetToBuffer(exportSheet: ExportSheet): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Avicont IA";
  workbook.created = new Date();

  const sheetName = exportSheet.title.substring(0, 31); // Excel: max 31 chars
  const worksheet = workbook.addWorksheet(sheetName, {
    pageSetup: { paperSize: 5, orientation: "portrait", fitToPage: true },
    views: [{ state: "normal" }],
  });

  // Anchos de columna: Cuenta, Código, Saldo BOB
  worksheet.columns = [
    { key: "account", width: 48 },
    { key: "code", width: 14 },
    { key: "balance", width: 16 },
  ];

  let rowNum = writeDocumentHeader(worksheet, exportSheet);

  // Escribir filas de datos
  for (const row of exportSheet.rows) {
    writeExportRow(worksheet, row, rowNum);
    rowNum++;
  }

  writeDocumentFooter(worksheet, rowNum);

  // Congelar las primeras N filas de encabezado (header doc + col headers)
  const frozenRows = exportSheet.preliminary ? 7 : 6;
  worksheet.views = [{ state: "frozen", ySplit: frozenRows - 1, xSplit: 0 }];

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
