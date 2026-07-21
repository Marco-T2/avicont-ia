import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Contract test for `FinancialStatementsExporterAdapter` — [EXPORT] cluster
 * paydown. TDD RED-first. UNLIKE its 6 sisters, none of these 4 underlying
 * exporter functions are "Result"-wrapped — they already return a plain
 * `Buffer` (financial-statements was the pre-existing "known-good" pattern
 * this cluster generalizes), so this adapter does zero unwrapping.
 */

const { mockExportBsPdf, mockExportBsXlsx, mockExportIsPdf, mockExportIsXlsx } = vi.hoisted(() => ({
  mockExportBsPdf: vi.fn(),
  mockExportBsXlsx: vi.fn(),
  mockExportIsPdf: vi.fn(),
  mockExportIsXlsx: vi.fn(),
}));

vi.mock("../exporters/pdf.exporter", () => ({
  exportBalanceSheetPdf: mockExportBsPdf,
  exportIncomeStatementPdf: mockExportIsPdf,
}));

vi.mock("../exporters/excel.exporter", () => ({
  exportBalanceSheetExcel: mockExportBsXlsx,
  exportIncomeStatementExcel: mockExportIsXlsx,
}));

import { FinancialStatementsExporterAdapter } from "../adapters/financial-statements-exporter.adapter";
import type { BalanceSheet, IncomeStatement } from "../../domain/types/financial-statements.types";
import type { FinancialStatementsOrgHeader } from "../../domain/ports/financial-statements-exporter.port";

const bs = { orgId: "org-1" } as unknown as BalanceSheet;
const is = { orgId: "org-1" } as unknown as IncomeStatement;
const org: FinancialStatementsOrgHeader = {
  name: "Avicont SA",
  nit: "12345",
  address: "La Paz",
  city: "La Paz",
};

describe("FinancialStatementsExporterAdapter — implements FinancialStatementsExporterPort, delegates to pure exporters", () => {
  beforeEach(() => {
    mockExportBsPdf.mockReset();
    mockExportBsXlsx.mockReset();
    mockExportIsPdf.mockReset();
    mockExportIsXlsx.mockReset();
  });

  it("exportBalanceSheetPdf: delegates to exportBalanceSheetPdf and forwards its Buffer as-is", async () => {
    const buffer = Buffer.from("%PDF-1.4 fake");
    mockExportBsPdf.mockResolvedValue(buffer);

    const adapter = new FinancialStatementsExporterAdapter();
    const result = await adapter.exportBalanceSheetPdf(bs, org);

    expect(result).toBe(buffer);
    expect(mockExportBsPdf).toHaveBeenCalledTimes(1);
    expect(mockExportBsPdf).toHaveBeenCalledWith(bs, org);
  });

  it("exportBalanceSheetXlsx: delegates to exportBalanceSheetExcel and forwards its Buffer as-is", async () => {
    const buffer = Buffer.from("PK fake xlsx");
    mockExportBsXlsx.mockResolvedValue(buffer);

    const adapter = new FinancialStatementsExporterAdapter();
    const result = await adapter.exportBalanceSheetXlsx(bs, org);

    expect(result).toBe(buffer);
    expect(mockExportBsXlsx).toHaveBeenCalledTimes(1);
    expect(mockExportBsXlsx).toHaveBeenCalledWith(bs, org);
  });

  it("exportIncomeStatementPdf: delegates to exportIncomeStatementPdf and forwards its Buffer as-is", async () => {
    const buffer = Buffer.from("%PDF-1.4 fake");
    mockExportIsPdf.mockResolvedValue(buffer);

    const adapter = new FinancialStatementsExporterAdapter();
    const result = await adapter.exportIncomeStatementPdf(is, org);

    expect(result).toBe(buffer);
    expect(mockExportIsPdf).toHaveBeenCalledTimes(1);
    expect(mockExportIsPdf).toHaveBeenCalledWith(is, org);
  });

  it("exportIncomeStatementXlsx: delegates to exportIncomeStatementExcel and forwards its Buffer as-is", async () => {
    const buffer = Buffer.from("PK fake xlsx");
    mockExportIsXlsx.mockResolvedValue(buffer);

    const adapter = new FinancialStatementsExporterAdapter();
    const result = await adapter.exportIncomeStatementXlsx(is, org);

    expect(result).toBe(buffer);
    expect(mockExportIsXlsx).toHaveBeenCalledTimes(1);
    expect(mockExportIsXlsx).toHaveBeenCalledWith(is, org);
  });
});
