/**
 * Exporter de Excel para Libro de Compras y Ventas IVA (Bolivia SIN).
 *
 * Genera un Buffer XLSX cuya estructura (columnas, orden, headers) coincide
 * exactamente con la plantilla oficial SIN:
 *  - PlantillaRegistro_ComprasEstandar.xlsx   (23 columnas)
 *  - PlantillaRegistro_ventas estandar.xlsx   (24 columnas)
 *
 * Valores monetarios: literales numéricos (no fórmulas) — auditables y
 * deterministas. Fila de totales = suma server-side de cada columna numérica.
 *
 * Runtime: Node.js (exceljs usa Buffer/streams nativos — no funciona en Edge).
 */

import ExcelJS from "exceljs";
import type { Prisma } from "@/generated/prisma/client";
import type { IvaPurchaseBookDTO, IvaSalesBookDTO } from "../iva-books.types";
import { getColumns, type IvaBookColumn } from "./sheet.builder";

// ── Formato numérico Bolivia (2 decimales, negativo entre paréntesis) ─────────

const NUMBER_FORMAT = "#,##0.00;(#,##0.00)";

// ── Helpers de estilo ─────────────────────────────────────────────────────────

function arialFont(opts: {
  bold?: boolean;
  size?: number;
  color?: string;
}): Partial<ExcelJS.Font> {
  return {
    name: "Arial",
    bold: opts.bold ?? false,
    size: opts.size ?? 9,
    color: { argb: opts.color ?? "FF000000" },
  };
}

/**
 * Convierte Prisma.Decimal | number | string | null | undefined a number.
 * Retorna 0 si el valor es nulo/inválido.
 */
function toNumber(v: Prisma.Decimal | number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

// ── Escritura de una celda según tipo ────────────────────────────────────────

function writeCellValue(
  cell: ExcelJS.Cell,
  value: unknown,
  col: IvaBookColumn,
): void {
  if (col.type === "number") {
    cell.value = toNumber(value as Prisma.Decimal | number | string | null | undefined);
    cell.numFmt = NUMBER_FORMAT;
    cell.alignment = { horizontal: "right", vertical: "middle" };
  } else if (col.type === "date") {
    // Almacenamos la fecha como string ISO "YYYY-MM-DD"
    cell.value = value != null ? String(value) : "";
    cell.alignment = { horizontal: "center", vertical: "middle" };
  } else {
    cell.value = value != null ? String(value) : "";
    cell.alignment = { horizontal: "left", vertical: "middle" };
  }
  cell.font = arialFont({ size: 9 });
}

// ── Extracción de valor de campo ──────────────────────────────────────────────

function getFieldValue(
  record: IvaPurchaseBookDTO | IvaSalesBookDTO,
  field: string,
  rowNum: number,
): unknown {
  // Campos virtuales (prefijo __)
  if (field === "__rowNum") return rowNum;
  if (field === "__duiDim") return "";       // no se captura en v1
  if (field === "__complemento") return "";  // no se captura en v1
  if (field === "__tipoVenta") return "";    // no se captura en v1

  // Ventas: estadoSIN
  if (field === "estadoSIN") {
    return (record as IvaSalesBookDTO).estadoSIN ?? "";
  }

  // Compras: tipoCompra (número)
  if (field === "tipoCompra") {
    return (record as IvaPurchaseBookDTO).tipoCompra ?? 0;
  }

  return (record as Record<string, unknown>)[field];
}

// ── Función principal de construcción de la hoja ─────────────────────────────

/**
 * Genera un Buffer XLSX con el Libro de Compras o Ventas IVA.
 *
 * @param kind    "purchases" | "sales"
 * @param entries Entradas del libro (DTOs ya validados/calculados)
 * @param periodLabel Etiqueta del período (solo alfanumérico y guiones) para el título
 * @returns Buffer con el archivo XLSX generado
 */
export async function exportIvaBookExcel(
  kind: "purchases" | "sales",
  entries: IvaPurchaseBookDTO[] | IvaSalesBookDTO[],
  periodLabel: string,
): Promise<Buffer> {
  const columns = getColumns(kind);
  const sheetTitle = kind === "purchases" ? "Libro de Compras IVA" : "Libro de Ventas IVA";

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Avicont IA";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sheetTitle, {
    pageSetup: {
      paperSize: 9, // A4
      orientation: "landscape",
      fitToPage: true,
    },
  });

  // ── Anchos de columna ──────────────────────────────────────────────────────
  worksheet.columns = columns.map((col) => ({
    width: col.width,
  })) as ExcelJS.Column[];

  // ── Fila 1: Título del documento ───────────────────────────────────────────
  const titleRow = worksheet.addRow([`${sheetTitle} — Período: ${periodLabel}`]);
  const lastColLetter = String.fromCharCode(64 + columns.length);
  worksheet.mergeCells(`A1:${lastColLetter}1`);
  const titleCell = titleRow.getCell(1);
  titleCell.font = arialFont({ bold: true, size: 12 });
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleRow.height = 20;

  // ── Fila 2: Encabezados de columna ─────────────────────────────────────────
  const headerValues = columns.map((col) => col.header);
  const headerRow = worksheet.addRow(headerValues);
  headerRow.height = 30;
  headerRow.eachCell((cell, colIdx) => {
    cell.font = arialFont({ bold: true, size: 9 });
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top:    { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } },
      left:   { style: "thin", color: { argb: "FFD1D5DB" } },
      right:  { style: "thin", color: { argb: "FFD1D5DB" } },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF3F4F6" },
    };
    // Alineación derecha para columnas numéricas
    if (columns[colIdx - 1]?.type === "number") {
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    }
  });

  // Congelar fila de encabezados (fila 2 = ySplit:2)
  worksheet.views = [{ state: "frozen", ySplit: 2 }];

  // ── Filas de datos ─────────────────────────────────────────────────────────
  // Acumuladores para totals de columnas numéricas
  const numericColIndices: number[] = [];
  columns.forEach((col, idx) => {
    if (col.type === "number" && col.field !== "__rowNum") {
      numericColIndices.push(idx);
    }
  });

  const colTotals: number[] = new Array(columns.length).fill(0);

  entries.forEach((record, entryIdx) => {
    const rowNum = entryIdx + 1;
    const rowValues = columns.map((col) => {
      const raw = getFieldValue(record, col.field, rowNum);
      if (col.type === "number" && col.field !== "__rowNum") {
        return toNumber(raw as Prisma.Decimal | number | string | null | undefined);
      }
      return raw;
    });

    const dataRow = worksheet.addRow(rowValues);
    dataRow.height = 16;

    dataRow.eachCell({ includeEmpty: true }, (cell, colIdx) => {
      const col = columns[colIdx - 1];
      if (!col) return;

      cell.font = arialFont({ size: 9 });

      if (col.type === "number" && col.field !== "__rowNum") {
        cell.numFmt = NUMBER_FORMAT;
        cell.alignment = { horizontal: "right", vertical: "middle" };
        const n = toNumber(rowValues[colIdx - 1] as number);
        colTotals[colIdx - 1] = (colTotals[colIdx - 1] ?? 0) + n;
      } else if (col.type === "date") {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else {
        cell.alignment = { horizontal: "left", vertical: "middle" };
      }
    });
  });

  // ── Fila de totales ────────────────────────────────────────────────────────
  const totalsValues = columns.map((col, idx) => {
    if (col.type === "number" && col.field !== "__rowNum") {
      return colTotals[idx] ?? 0;
    }
    if (idx === 0) return "TOTALES";
    return null;
  });

  const totalsRow = worksheet.addRow(totalsValues);
  totalsRow.height = 16;
  totalsRow.eachCell({ includeEmpty: true }, (cell, colIdx) => {
    const col = columns[colIdx - 1];
    if (!col) return;

    cell.font = arialFont({ bold: true, size: 9 });
    cell.border = {
      top: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "double", color: { argb: "FF000000" } },
    };

    if (col.type === "number" && col.field !== "__rowNum") {
      cell.numFmt = NUMBER_FORMAT;
      cell.alignment = { horizontal: "right", vertical: "middle" };
    } else if (colIdx === 1) {
      cell.alignment = { horizontal: "left", vertical: "middle" };
    }
  });

  // ── Generar Buffer ─────────────────────────────────────────────────────────
  const xlsxBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(xlsxBuffer);
}
