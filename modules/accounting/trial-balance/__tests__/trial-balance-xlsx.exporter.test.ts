/**
 * B7 — RED: XLSX exporter tests.
 *
 * Covers: C7.S1-S6, C7.E1, C8.S1-S4
 * All tests parse the actual XLSX buffer via ExcelJS to inspect cell values,
 * styles, and structure.
 */

import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { Prisma } from "@/generated/prisma/client";
import { exportTrialBalanceXlsx } from "../infrastructure/exporters/trial-balance-xlsx.exporter";
import type { TrialBalanceReport } from "../domain/trial-balance.types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const D = (v: string | number) => new Prisma.Decimal(String(v));

function makeReport(overrides?: Partial<TrialBalanceReport>): TrialBalanceReport {
  return {
    orgId: "org-1",
    dateFrom: new Date("2025-01-01"),
    dateTo: new Date("2025-12-31"),
    rows: [
      {
        accountId: "acc-1",
        code: "1.1.1",
        name: "Caja",
        sumasDebe: D("1234567.89"),
        sumasHaber: D("0"),
        saldoDeudor: D("1234567.89"),
        saldoAcreedor: D("0"),
      },
      {
        accountId: "acc-2",
        code: "2.1.1",
        name: "Proveedores",
        sumasDebe: D("0"),
        sumasHaber: D("500"),
        saldoDeudor: D("0"),
        saldoAcreedor: D("500"),
      },
    ],
    totals: {
      sumasDebe: D("1234567.89"),
      sumasHaber: D("500"),
      saldoDeudor: D("1234567.89"),
      saldoAcreedor: D("500"),
    },
    imbalanced: false,
    deltaSumas: D("0"),
    deltaSaldos: D("0"),
    oppositeSignAccounts: [],
    ...overrides,
  };
}

 
async function parseWorkbook(buffer: any): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
   
  await wb.xlsx.load(buffer);
  return wb;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("exportTrialBalanceXlsx — sheet structure (C7.S1)", () => {
  it("C7.S1 — sheet name is 'Sumas y Saldos'", async () => {
    const buffer = await exportTrialBalanceXlsx(makeReport(), "Avicont SA");
    const wb = await parseWorkbook(buffer);
    expect(wb.getWorksheet("Sumas y Saldos")).toBeDefined();
  });
});

describe("exportTrialBalanceXlsx — column count (C7.S2)", () => {
  it("C7.S2 — data rows have values in 7 columns (A-G)", async () => {
    const buffer = await exportTrialBalanceXlsx(makeReport(), "Avicont SA");
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Sumas y Saldos")!;
    // Row 8 = first data row
    const row8 = sheet.getRow(8);
    // Should have N°, code, name in cols 1-3
    expect(row8.getCell(1).value).toBe(1);    // N°
    expect(row8.getCell(2).value).toBe("1.1.1");  // Código
    expect(row8.getCell(3).value).toBe("Caja");   // Cuenta
  });
});

describe("exportTrialBalanceXlsx — numeric values (C7.S3)", () => {
  it("C7.S3 — sumasDebe=1234567.89 stored as number 1234567.89", async () => {
    const buffer = await exportTrialBalanceXlsx(makeReport(), "Avicont SA");
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Sumas y Saldos")!;
    // Row 8 = first data row; col 4 = Sumas Debe
    const cell = sheet.getRow(8).getCell(4);
    expect(cell.value).toBe(1234567.89);
  });

  it("C7.S3 — zero sumasHaber → empty string (not 0)", async () => {
    const buffer = await exportTrialBalanceXlsx(makeReport(), "Avicont SA");
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Sumas y Saldos")!;
    // Row 8, col 5 = Sumas Haber (zero for Caja row)
    const cell = sheet.getRow(8).getCell(5);
    expect(cell.value).toBe("");
  });
});

describe("exportTrialBalanceXlsx — numFmt (C7.S4)", () => {
  it("C7.S4 — non-zero numeric cells have numFmt '#,##0.00;(#,##0.00)'", async () => {
    const buffer = await exportTrialBalanceXlsx(makeReport(), "Avicont SA");
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Sumas y Saldos")!;
    const cell = sheet.getRow(8).getCell(4); // Sumas Debe of Caja
    expect(cell.numFmt).toBe("#,##0.00;(#,##0.00)");
  });
});

describe("exportTrialBalanceXlsx — frozen pane (C7.S5)", () => {
  it("C7.S5 — frozen pane xSplit=3, ySplit=7", async () => {
    const buffer = await exportTrialBalanceXlsx(makeReport(), "Avicont SA");
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Sumas y Saldos")!;
    // Cast to unknown first to access xSplit/ySplit which ExcelJS types as a union
    const view = sheet.views[0] as unknown as { state: string; xSplit: number; ySplit: number };
    expect(view.state).toBe("frozen");
    expect(view.xSplit).toBe(3);
    expect(view.ySplit).toBe(7);
  });
});

describe("exportTrialBalanceXlsx — TOTAL row (C7.S6)", () => {
  it("C7.S6 — TOTAL label in col A of last data row (bold)", async () => {
    const buffer = await exportTrialBalanceXlsx(makeReport(), "Avicont SA");
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Sumas y Saldos")!;
    // 2 data rows → TOTAL is at row 10 (row7=headers, row8=Caja, row9=Proveedores, row10=TOTAL)
    const totalCell = sheet.getRow(10).getCell(1);
    expect(totalCell.value).toBe("TOTAL");
    expect(totalCell.font?.bold).toBe(true);
  });

  it("C7.S6 — TOTAL numeric cells are numbers (not empty)", async () => {
    const buffer = await exportTrialBalanceXlsx(makeReport(), "Avicont SA");
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Sumas y Saldos")!;
    const totalRow = sheet.getRow(10);
    // Col 4 = Sumas Debe total
    expect(typeof totalRow.getCell(4).value).toBe("number");
    expect(totalRow.getCell(4).value).toBe(1234567.89);
  });
});

describe("exportTrialBalanceXlsx — edge cases (C7.E1)", () => {
  it("C7.E1 — empty rows → buffer produced (no crash), TOTAL row at row 8", async () => {
    const emptyReport = makeReport({
      rows: [],
      totals: {
        sumasDebe: D("0"),
        sumasHaber: D("0"),
        saldoDeudor: D("0"),
        saldoAcreedor: D("0"),
      },
    });
    const buffer = await exportTrialBalanceXlsx(emptyReport, "Avicont SA");
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(0);
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Sumas y Saldos")!;
    // No data rows → TOTAL should be row 8
    const totalCell = sheet.getRow(8).getCell(1);
    expect(totalCell.value).toBe("TOTAL");
  });
});

describe("exportTrialBalanceXlsx — header metadata (C8)", () => {
  it("C8.S1 — row 1 contains title; row 2 contains org name", async () => {
    const buffer = await exportTrialBalanceXlsx(makeReport(), "Avicont SA", "1001", "Av. Principal 123");
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Sumas y Saldos")!;
    const title = sheet.getRow(1).getCell(1).value as string;
    expect(title).toContain("BALANCE DE COMPROBACIÓN");
    const empresa = sheet.getRow(2).getCell(1).value as string;
    expect(empresa).toContain("Avicont SA");
  });

  it("C8.S2 — taxId present → row 3 contains 'NIT: 1001'", async () => {
    const buffer = await exportTrialBalanceXlsx(makeReport(), "Avicont SA", "1001");
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Sumas y Saldos")!;
    const line3 = sheet.getRow(3).getCell(1).value as string;
    expect(line3).toContain("NIT: 1001");
  });

  it("C8.S3 — taxId=null, address present → row 3 contains address only", async () => {
    const buffer = await exportTrialBalanceXlsx(makeReport(), "Avicont SA", undefined, "Av. Principal 123");
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Sumas y Saldos")!;
    const line3 = sheet.getRow(3).getCell(1).value as string;
    expect(line3).toContain("Av. Principal 123");
    expect(line3).not.toContain("NIT:");
  });

  it("C8.S4 — both taxId and address null → row 3 is empty", async () => {
    const buffer = await exportTrialBalanceXlsx(makeReport(), "Avicont SA");
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Sumas y Saldos")!;
    const line3Value = sheet.getRow(3).getCell(1).value;
    // Either null, undefined, or empty string — no NIT/Dirección
    expect(line3Value == null || line3Value === "").toBe(true);
  });
});

describe("exportTrialBalanceXlsx — imbalance warning (C7.S6)", () => {
  it("report.imbalanced=true → row 6 has imbalance warning (red fill)", async () => {
    const imbalancedReport = makeReport({
      imbalanced: true,
      deltaSumas: D("-50"),
      deltaSaldos: D("10"),
    });
    const buffer = await exportTrialBalanceXlsx(imbalancedReport, "Avicont SA");
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Sumas y Saldos")!;
    const warnCell = sheet.getRow(6).getCell(1);
    const value = warnCell.value as string;
    expect(value).toContain("desbalanceado");
    // Red fill check
    const fill = warnCell.fill as ExcelJS.FillPattern | undefined;
    expect(fill?.fgColor?.argb).toBe("FFFEF2F2");
  });

  it("report.imbalanced=false → row 6 is empty", async () => {
    const buffer = await exportTrialBalanceXlsx(makeReport(), "Avicont SA");
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Sumas y Saldos")!;
    const cell = sheet.getRow(6).getCell(1);
    expect(cell.value == null || cell.value === "").toBe(true);
  });
});

describe("exportTrialBalanceXlsx — column widths", () => {
  it("column A width is 6, column C width is 44", async () => {
    const buffer = await exportTrialBalanceXlsx(makeReport(), "Avicont SA");
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Sumas y Saldos")!;
    expect(sheet.getColumn(1).width).toBe(6);   // A
    expect(sheet.getColumn(3).width).toBe(44);  // C
  });
});

describe("exportTrialBalanceXlsx — buffer signature", () => {
  it("buffer is a valid XLSX (starts with PK magic bytes)", async () => {
    const buffer = await exportTrialBalanceXlsx(makeReport(), "Avicont SA");
    // XLSX is a ZIP — PK header is 0x50 0x4B
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4B);
  });
});
