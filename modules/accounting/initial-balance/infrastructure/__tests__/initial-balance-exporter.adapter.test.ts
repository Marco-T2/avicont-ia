import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Contract test for `InitialBalanceExporterAdapter` — [EXPORT] cluster
 * paydown. TDD RED-first. Sister of `equity-statement-exporter.adapter.test.ts`
 * — see that file's header for rationale.
 */

const { mockExportPdf, mockExportXlsx } = vi.hoisted(() => ({
  mockExportPdf: vi.fn(),
  mockExportXlsx: vi.fn(),
}));

vi.mock("../exporters/initial-balance-pdf.exporter", () => ({
  exportInitialBalancePdf: mockExportPdf,
}));

vi.mock("../exporters/initial-balance-xlsx.exporter", () => ({
  exportInitialBalanceXlsx: mockExportXlsx,
}));

import { InitialBalanceExporterAdapter } from "../adapters/initial-balance-exporter.adapter";
import type { InitialBalanceStatement } from "../../domain/initial-balance.types";

const statement = { orgId: "org-1" } as unknown as InitialBalanceStatement;

describe("InitialBalanceExporterAdapter — implements InitialBalanceExporterPort, delegates to pure exporters", () => {
  beforeEach(() => {
    mockExportPdf.mockReset();
    mockExportXlsx.mockReset();
  });

  it("exportPdf: delegates to exportInitialBalancePdf and unwraps { buffer } to a plain Buffer", async () => {
    const pdfBuffer = Buffer.from("%PDF-1.4 fake");
    mockExportPdf.mockResolvedValue({ buffer: pdfBuffer, docDef: {} });

    const adapter = new InitialBalanceExporterAdapter();
    const result = await adapter.exportPdf(statement);

    expect(result).toBe(pdfBuffer);
    expect(mockExportPdf).toHaveBeenCalledTimes(1);
    expect(mockExportPdf).toHaveBeenCalledWith(statement);
  });

  it("exportXlsx: delegates to exportInitialBalanceXlsx and forwards its Buffer as-is", async () => {
    const xlsxBuffer = Buffer.from("PK fake xlsx");
    mockExportXlsx.mockResolvedValue(xlsxBuffer);

    const adapter = new InitialBalanceExporterAdapter();
    const result = await adapter.exportXlsx(statement);

    expect(result).toBe(xlsxBuffer);
    expect(mockExportXlsx).toHaveBeenCalledTimes(1);
    expect(mockExportXlsx).toHaveBeenCalledWith(statement);
  });
});
