/**
 * Tests para `exportLedgerXlsx`.
 *
 * Cobertura:
 * - Sheet name "Libro Mayor".
 * - Header rows con empresa + cuenta + período.
 * - Column headers en row 7.
 * - Opening balance row decorativa (presente si !== "0.00", ausente si "0.00").
 * - Decimal numFmt es-BO.
 * - Frozen pane.
 * - Buffer es ZIP (XLSX) válido.
 *
 * Mirror de `trial-balance-xlsx.exporter.test.ts` (paired sister precedent).
 */

import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import {
  exportLedgerXlsx,
  type LedgerXlsxOptions,
} from "../infrastructure/exporters/ledger/ledger-xlsx.exporter";
import type { LedgerEntry } from "../presentation/dto/ledger.types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEntry(overrides?: Partial<LedgerEntry>): LedgerEntry {
  return {
    entryId: "je-1",
    date: new Date("2025-06-15"),
    entryNumber: 1,
    voucherCode: "CI",
    displayNumber: "D2506-000001",
    description: "Ingreso por venta",
    debit: "1234567.89",
    credit: "0.00",
    balance: "1234567.89",
    ...overrides,
  };
}

function makeOpts(overrides?: Partial<LedgerXlsxOptions>): LedgerXlsxOptions {
  return {
    accountCode: "1.1.1",
    accountName: "Caja",
    dateFrom: "2025-01-01",
    dateTo: "2025-12-31",
    openingBalance: "0.00",
    ...overrides,
  };
}


async function parseWorkbook(buffer: any): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("exportLedgerXlsx — sheet structure", () => {
  it("sheet name es 'Libro Mayor'", async () => {
    const buffer = await exportLedgerXlsx([makeEntry()], makeOpts(), "Avicont SA");
    const wb = await parseWorkbook(buffer);
    expect(wb.getWorksheet("Libro Mayor")).toBeDefined();
  });
});

describe("exportLedgerXlsx — header rows", () => {
  it("row 1 es título 'LIBRO MAYOR'; row 2 es empresa", async () => {
    const buffer = await exportLedgerXlsx(
      [makeEntry()],
      makeOpts(),
      "Avicont SA",
      "1001",
      "Av. Principal 123",
    );
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Libro Mayor")!;
    expect(sheet.getRow(1).getCell(1).value).toBe("LIBRO MAYOR");
    expect(sheet.getRow(2).getCell(1).value).toBe("Empresa: Avicont SA");
  });

  it("row 3 contiene NIT + dirección", async () => {
    const buffer = await exportLedgerXlsx(
      [makeEntry()],
      makeOpts(),
      "Avicont SA",
      "1001",
      "Av. Principal 123",
    );
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Libro Mayor")!;
    const line3 = sheet.getRow(3).getCell(1).value as string;
    expect(line3).toContain("NIT: 1001");
    expect(line3).toContain("Av. Principal 123");
  });

  it("row 3 omitida cuando NIT/dir/ciudad ausentes", async () => {
    const buffer = await exportLedgerXlsx([makeEntry()], makeOpts(), "Avicont SA");
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Libro Mayor")!;
    const line3 = sheet.getRow(3).getCell(1).value;
    expect(line3 == null || line3 === "").toBe(true);
  });

  it("row 4 muestra 'Cuenta: {code} — {name}'", async () => {
    const buffer = await exportLedgerXlsx([makeEntry()], makeOpts({ accountCode: "1.1.1", accountName: "Caja" }), "Avicont SA");
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Libro Mayor")!;
    const cuenta = sheet.getRow(4).getCell(1).value as string;
    expect(cuenta).toContain("1.1.1");
    expect(cuenta).toContain("Caja");
  });

  it("row 5 muestra período DD/MM/YYYY", async () => {
    const buffer = await exportLedgerXlsx(
      [makeEntry()],
      makeOpts({ dateFrom: "2025-01-01", dateTo: "2025-12-31" }),
      "Avicont SA",
    );
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Libro Mayor")!;
    const period = sheet.getRow(5).getCell(1).value as string;
    expect(period).toContain("01/01/2025");
    expect(period).toContain("31/12/2025");
  });

  it("row 6 es '(Expresado en Bolivianos)'", async () => {
    const buffer = await exportLedgerXlsx([makeEntry()], makeOpts(), "Avicont SA");
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Libro Mayor")!;
    const expresado = sheet.getRow(6).getCell(1).value as string;
    expect(expresado).toBe("(Expresado en Bolivianos)");
  });
});

describe("exportLedgerXlsx — column headers (row 7)", () => {
  it("row 7 tiene los 7 column headers", async () => {
    const buffer = await exportLedgerXlsx([makeEntry()], makeOpts(), "Avicont SA");
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Libro Mayor")!;
    const row7 = sheet.getRow(7);
    expect(row7.getCell(1).value).toBe("Fecha");
    expect(row7.getCell(2).value).toBe("Tipo");
    expect(row7.getCell(3).value).toBe("Nº");
    expect(row7.getCell(4).value).toBe("Descripción");
    expect(row7.getCell(5).value).toBe("Debe");
    expect(row7.getCell(6).value).toBe("Haber");
    expect(row7.getCell(7).value).toBe("Saldo");
  });
});

describe("exportLedgerXlsx — opening balance row", () => {
  it("opening !== '0.00' → row 8 es 'Saldo inicial acumulado' (decorativa)", async () => {
    const buffer = await exportLedgerXlsx(
      [makeEntry()],
      makeOpts({ openingBalance: "5000.00" }),
      "Avicont SA",
    );
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Libro Mayor")!;
    expect(sheet.getRow(8).getCell(4).value).toBe("Saldo inicial acumulado");
    expect(sheet.getRow(8).getCell(7).value).toBe(5000);
  });

  it("opening === '0.00' → row 8 es la primera fila de datos (sin opening)", async () => {
    const buffer = await exportLedgerXlsx(
      [makeEntry()],
      makeOpts({ openingBalance: "0.00" }),
      "Avicont SA",
    );
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Libro Mayor")!;
    // row 8 debe ser la primera entry, NO 'Saldo inicial acumulado'
    expect(sheet.getRow(8).getCell(4).value).not.toBe("Saldo inicial acumulado");
    // El displayNumber debe estar en col C
    expect(sheet.getRow(8).getCell(3).value).toBe("D2506-000001");
  });
});

describe("exportLedgerXlsx — data row numeric values", () => {
  it("debit=1234567.89 → cell value es number 1234567.89", async () => {
    const buffer = await exportLedgerXlsx(
      [makeEntry({ debit: "1234567.89", credit: "0.00", balance: "1234567.89" })],
      makeOpts(),
      "Avicont SA",
    );
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Libro Mayor")!;
    // row 8 col 5 = Debe
    expect(sheet.getRow(8).getCell(5).value).toBe(1234567.89);
  });

  it("credit=0.00 → cell value es empty string (zero convention)", async () => {
    const buffer = await exportLedgerXlsx(
      [makeEntry({ debit: "100.00", credit: "0.00", balance: "100.00" })],
      makeOpts(),
      "Avicont SA",
    );
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Libro Mayor")!;
    // row 8 col 6 = Haber (cero)
    expect(sheet.getRow(8).getCell(6).value).toBe("");
  });

  it("balance=0.00 → cell value es 0 (forceShow para running balance)", async () => {
    const buffer = await exportLedgerXlsx(
      [makeEntry({ debit: "100.00", credit: "100.00", balance: "0.00" })],
      makeOpts(),
      "Avicont SA",
    );
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Libro Mayor")!;
    // row 8 col 7 = Saldo (debe mostrar 0, no "")
    expect(sheet.getRow(8).getCell(7).value).toBe(0);
  });
});

describe("exportLedgerXlsx — numFmt", () => {
  it("cell numéricas no-cero tienen numFmt '#,##0.00;(#,##0.00)'", async () => {
    const buffer = await exportLedgerXlsx([makeEntry()], makeOpts(), "Avicont SA");
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Libro Mayor")!;
    // row 8 col 5 = Debe
    expect(sheet.getRow(8).getCell(5).numFmt).toBe("#,##0.00;(#,##0.00)");
  });
});

describe("exportLedgerXlsx — frozen pane", () => {
  it("frozen pane ySplit=7 (lock header rows)", async () => {
    const buffer = await exportLedgerXlsx([makeEntry()], makeOpts(), "Avicont SA");
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Libro Mayor")!;
    const view = sheet.views[0] as unknown as { state: string; ySplit: number };
    expect(view.state).toBe("frozen");
    expect(view.ySplit).toBe(7);
  });
});

describe("exportLedgerXlsx — edge cases", () => {
  it("entries=[] + opening='0.00' → buffer producido (no crash)", async () => {
    const buffer = await exportLedgerXlsx([], makeOpts({ openingBalance: "0.00" }), "Avicont SA");
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(0);
  });
});

describe("exportLedgerXlsx — buffer signature", () => {
  it("buffer es ZIP válido (PK magic bytes)", async () => {
    const buffer = await exportLedgerXlsx([makeEntry()], makeOpts(), "Avicont SA");
    expect(buffer[0]).toBe(0x50);  // 'P'
    expect(buffer[1]).toBe(0x4b);  // 'K'
  });
});
