/**
 * Tests del Excel Exporter del Libro IVA.
 *
 * Estrategia golden-file:
 * - Carga las plantillas SIN oficiales desde __fixtures__
 * - Compara los headers generados vs los headers de la plantilla
 * - Verifica que las celdas monetarias son numéricas (no strings)
 * - Verifica la fila de totales
 * - Verifica que compras 100% exentas (baseCF=0, creditoFiscal=0) no generan error
 *
 * PR5 — Tasks 5.1 y 5.2
 */

import { describe, it, expect } from "vitest";
import path from "path";
import ExcelJS from "exceljs";
import { Prisma } from "@/generated/prisma/client";
import { exportIvaBookExcel } from "../exporters/excel.exporter";
import { PURCHASES_COLUMNS, SALES_COLUMNS } from "../exporters/sheet.builder";
import type { IvaPurchaseBookDTO, IvaSalesBookDTO } from "../iva-books.types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FIXTURES_DIR = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "../exporters/__fixtures__",
);

const COMPRAS_FIXTURE = path.join(FIXTURES_DIR, "PlantillaRegistro_ComprasEstandar.xlsx");
const VENTAS_FIXTURE = path.join(FIXTURES_DIR, "PlantillaRegistro_ventas estandar.xlsx");

// ── Helpers ───────────────────────────────────────────────────────────────────

const D = (v: string | number) => new Prisma.Decimal(String(v));
const ZERO = D("0");
const TASA_IVA = D("0.1300");

function makePurchaseDTO(overrides: Partial<IvaPurchaseBookDTO> = {}): IvaPurchaseBookDTO {
  return {
    id: "purchase-001",
    organizationId: "org-001",
    fiscalPeriodId: "period-001",
    fechaFactura: "2025-03-15",
    nitProveedor: "1234567",
    razonSocial: "Proveedor SRL",
    numeroFactura: "FAC-001",
    codigoAutorizacion: "AUTH-12345678901234",
    codigoControl: "CTRL-001",
    tipoCompra: 1,
    importeTotal: D("1000.00"),
    importeIce: ZERO,
    importeIehd: ZERO,
    importeIpj: ZERO,
    tasas: ZERO,
    otrosNoSujetos: ZERO,
    exentos: ZERO,
    tasaCero: ZERO,
    subtotal: D("1000.00"),
    dfIva: D("130.00"),
    codigoDescuentoAdicional: ZERO,
    importeGiftCard: ZERO,
    baseIvaSujetoCf: D("1000.00"),
    dfCfIva: D("130.00"),
    tasaIva: TASA_IVA,
    status: "ACTIVE",
    createdAt: new Date("2025-03-15T10:00:00Z"),
    updatedAt: new Date("2025-03-15T10:00:00Z"),
    ...overrides,
  };
}

function makeSaleDTO(overrides: Partial<IvaSalesBookDTO> = {}): IvaSalesBookDTO {
  return {
    id: "sale-001",
    organizationId: "org-001",
    fiscalPeriodId: "period-001",
    fechaFactura: "2025-03-15",
    nitCliente: "9876543",
    razonSocial: "Cliente SRL",
    numeroFactura: "VTA-001",
    codigoAutorizacion: "AUTH-98765432101234",
    codigoControl: "CTRL-VTA-001",
    estadoSIN: "A",
    importeTotal: D("2000.00"),
    importeIce: ZERO,
    importeIehd: ZERO,
    importeIpj: ZERO,
    tasas: ZERO,
    otrosNoSujetos: ZERO,
    exentos: ZERO,
    tasaCero: ZERO,
    subtotal: D("2000.00"),
    dfIva: D("260.00"),
    codigoDescuentoAdicional: ZERO,
    importeGiftCard: ZERO,
    baseIvaSujetoCf: D("2000.00"),
    dfCfIva: D("260.00"),
    tasaIva: TASA_IVA,
    status: "ACTIVE",
    createdAt: new Date("2025-03-15T10:00:00Z"),
    updatedAt: new Date("2025-03-15T10:00:00Z"),
    ...overrides,
  };
}

/**
 * Lee los headers de la primera fila de un XLSX (usando exceljs).
 * Retorna array de strings (valor de cada celda con contenido).
 */
async function readXlsxHeaders(filePath: string): Promise<string[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0];
  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell) => {
    if (cell.value != null) {
      headers.push(String(cell.value));
    }
  });
  return headers;
}

/**
 * Lee los headers de la fila 2 de un Buffer XLSX generado por el exporter
 * (fila 1 = título, fila 2 = encabezados de columna).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readGeneratedHeaders(buffer: any): Promise<string[]> {
  const wb = new ExcelJS.Workbook();
  // @ts-expect-error — Buffer<ArrayBuffer> vs Buffer: discrepancia entre @types/node y exceljs
  await wb.xlsx.load(Buffer.from(buffer));
  const ws = wb.worksheets[0];
  const headers: string[] = [];
  ws.getRow(2).eachCell({ includeEmpty: false }, (cell) => {
    if (cell.value != null) {
      headers.push(String(cell.value));
    }
  });
  return headers;
}

// ── Tests: Golden-file — Compras ─────────────────────────────────────────────

describe("exportIvaBookExcel('purchases') — golden-file vs plantilla SIN", () => {
  it("los headers generados coinciden con los headers de la plantilla SIN Compras", async () => {
    const entries = [makePurchaseDTO()];
    const buffer = await exportIvaBookExcel("purchases", entries, "2025-03");

    const generated = await readGeneratedHeaders(buffer);
    const fixture = await readXlsxHeaders(COMPRAS_FIXTURE);

    // Los headers de la plantilla SIN son los que debemos reproducir
    // Nota: la plantilla tiene 23 columnas (col 24 y 25 son null en el fixture)
    const fixtureNonNull = fixture.filter((h) => h.trim() !== "");

    // Todos los headers de la plantilla deben aparecer en el generado
    for (const header of fixtureNonNull) {
      expect(
        generated,
        `Header "${header}" de la plantilla SIN no aparece en el generado`,
      ).toContain(header);
    }
  });

  it("los headers generados siguen el ORDEN EXACTO de la plantilla SIN Compras", async () => {
    const entries = [makePurchaseDTO()];
    const buffer = await exportIvaBookExcel("purchases", entries, "2025-03");

    const generated = await readGeneratedHeaders(buffer);
    const fixture = await readXlsxHeaders(COMPRAS_FIXTURE);
    const fixtureNonNull = fixture.filter((h) => h.trim() !== "");

    // Verificar que el orden coincide para todos los headers presentes
    let lastIdx = -1;
    for (const header of fixtureNonNull) {
      const idx = generated.indexOf(header);
      expect(idx, `Header "${header}" debe aparecer después del anterior`).toBeGreaterThan(lastIdx);
      lastIdx = idx;
    }
  });

  it("tiene exactamente 23 columnas (headers SIN Compras)", async () => {
    expect(PURCHASES_COLUMNS).toHaveLength(23);
  });

  it("las celdas monetarias son numéricas (no strings) en compras", async () => {
    const entries = [makePurchaseDTO({ importeTotal: D("1000.00"), dfCfIva: D("130.00") })];
    const buffer = await exportIvaBookExcel("purchases", entries, "2025-03");

    const wb = new ExcelJS.Workbook();
    // @ts-expect-error — Buffer<ArrayBuffer> vs Buffer: discrepancia entre @types/node y exceljs
    await wb.xlsx.load(Buffer.from(buffer));
    const ws = wb.worksheets[0];

    // Fila 3 = primera fila de datos (fila 1=título, fila 2=headers)
    const dataRow = ws.getRow(3);

    // Columna 9 = IMPORTE TOTAL COMPRA (type: number)
    const importeTotalCell = dataRow.getCell(9);
    expect(typeof importeTotalCell.value).toBe("number");
    expect(importeTotalCell.value).toBe(1000);

    // Columna 21 = CREDITO FISCAL (type: number) — 1000 × 0.13 = 130
    const creditoFiscalCell = dataRow.getCell(21);
    expect(typeof creditoFiscalCell.value).toBe("number");
    expect(creditoFiscalCell.value).toBeCloseTo(130, 1);
  });

  it("la fila de totales está presente y contiene valores numéricos", async () => {
    const entries = [
      makePurchaseDTO({ importeTotal: D("1000.00") }),
      makePurchaseDTO({ importeTotal: D("2000.00"), numeroFactura: "FAC-002" }),
    ];
    const buffer = await exportIvaBookExcel("purchases", entries, "2025-03");

    const wb = new ExcelJS.Workbook();
    // @ts-expect-error — Buffer<ArrayBuffer> vs Buffer: discrepancia entre @types/node y exceljs
    await wb.xlsx.load(Buffer.from(buffer));
    const ws = wb.worksheets[0];

    // Total rows: título (1) + headers (1) + 2 entries + 1 totals = row 5
    const totalsRow = ws.getRow(5);
    // Col 1 = "TOTALES" label
    expect(String(totalsRow.getCell(1).value)).toBe("TOTALES");
    // Col 9 = suma de IMPORTE TOTAL (1000 + 2000 = 3000)
    const totalImporte = totalsRow.getCell(9).value;
    expect(typeof totalImporte).toBe("number");
    expect(totalImporte).toBe(3000);
  });
});

// ── Tests: Golden-file — Ventas ───────────────────────────────────────────────

describe("exportIvaBookExcel('sales') — golden-file vs plantilla SIN", () => {
  it("los headers generados coinciden con los headers de la plantilla SIN Ventas", async () => {
    const entries = [makeSaleDTO()];
    const buffer = await exportIvaBookExcel("sales", entries, "2025-03");

    const generated = await readGeneratedHeaders(buffer);
    const fixture = await readXlsxHeaders(VENTAS_FIXTURE);
    const fixtureNonNull = fixture.filter((h) => h.trim() !== "");

    for (const header of fixtureNonNull) {
      expect(
        generated,
        `Header "${header}" de la plantilla SIN Ventas no aparece en el generado`,
      ).toContain(header);
    }
  });

  it("los headers generados siguen el ORDEN EXACTO de la plantilla SIN Ventas", async () => {
    const entries = [makeSaleDTO()];
    const buffer = await exportIvaBookExcel("sales", entries, "2025-03");

    const generated = await readGeneratedHeaders(buffer);
    const fixture = await readXlsxHeaders(VENTAS_FIXTURE);
    const fixtureNonNull = fixture.filter((h) => h.trim() !== "");

    let lastIdx = -1;
    for (const header of fixtureNonNull) {
      const idx = generated.indexOf(header);
      expect(idx, `Header "${header}" debe aparecer después del anterior`).toBeGreaterThan(lastIdx);
      lastIdx = idx;
    }
  });

  it("tiene exactamente 24 columnas (headers SIN Ventas)", async () => {
    expect(SALES_COLUMNS).toHaveLength(24);
  });

  it("las celdas monetarias son numéricas (no strings) en ventas", async () => {
    const entries = [makeSaleDTO({ importeTotal: D("2000.00"), dfIva: D("260.00") })];
    const buffer = await exportIvaBookExcel("sales", entries, "2025-03");

    const wb = new ExcelJS.Workbook();
    // @ts-expect-error — Buffer<ArrayBuffer> vs Buffer: discrepancia entre @types/node y exceljs
    await wb.xlsx.load(Buffer.from(buffer));
    const ws = wb.worksheets[0];

    // Fila 3 = primera fila de datos
    const dataRow = ws.getRow(3);

    // Columna 9 = IMPORTE TOTAL DE LA VENTA
    const importeTotalCell = dataRow.getCell(9);
    expect(typeof importeTotalCell.value).toBe("number");
    expect(importeTotalCell.value).toBe(2000);

    // Columna 21 = DEBITO FISCAL — 2000 × 0.13 = 260
    const debitoFiscalCell = dataRow.getCell(21);
    expect(typeof debitoFiscalCell.value).toBe("number");
    expect(debitoFiscalCell.value).toBeCloseTo(260, 1);
  });

  it("el campo estadoSIN se exporta como texto en la columna ESTADO", async () => {
    const entries = [makeSaleDTO({ estadoSIN: "A" })];
    const buffer = await exportIvaBookExcel("sales", entries, "2025-03");

    const wb = new ExcelJS.Workbook();
    // @ts-expect-error — Buffer<ArrayBuffer> vs Buffer: discrepancia entre @types/node y exceljs
    await wb.xlsx.load(Buffer.from(buffer));
    const ws = wb.worksheets[0];

    const dataRow = ws.getRow(3);
    // Columna 22 = ESTADO
    const estadoCell = dataRow.getCell(22);
    expect(estadoCell.value).toBe("A");
  });
});

// ── Tests: Caso borde — compra 100% exenta (Task 5.2) ────────────────────────

describe("exportIvaBookExcel — compra 100% exenta (baseCF=0, creditoFiscal=0)", () => {
  it("genera el archivo sin error y con IVA = 0 en la columna CREDITO FISCAL", async () => {
    const exemptPurchase = makePurchaseDTO({
      importeTotal: D("500.00"),
      exentos: D("500.00"),
      subtotal: ZERO,
      baseIvaSujetoCf: ZERO,
      dfCfIva: ZERO,
      dfIva: ZERO,
    });

    // No debe lanzar error
    const buffer = await exportIvaBookExcel("purchases", [exemptPurchase], "2025-03");
    expect(buffer).toBeInstanceOf(Buffer);

    const wb = new ExcelJS.Workbook();
    // @ts-expect-error — Buffer<ArrayBuffer> vs Buffer: discrepancia entre @types/node y exceljs
    await wb.xlsx.load(Buffer.from(buffer));
    const ws = wb.worksheets[0];

    const dataRow = ws.getRow(3);
    // Col 21 = CREDITO FISCAL debe ser 0
    const creditoFiscalCell = dataRow.getCell(21);
    expect(typeof creditoFiscalCell.value).toBe("number");
    expect(creditoFiscalCell.value).toBe(0);
  });
});

// ── Tests: Buffer retornado es válido ──────────────────────────────────────────

describe("exportIvaBookExcel — validación de Buffer", () => {
  it("retorna un Buffer no vacío para lista vacía de entradas", async () => {
    const buffer = await exportIvaBookExcel("purchases", [], "2025-03");
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("retorna un Buffer no vacío para lista vacía de ventas", async () => {
    const buffer = await exportIvaBookExcel("sales", [], "2025-03");
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
