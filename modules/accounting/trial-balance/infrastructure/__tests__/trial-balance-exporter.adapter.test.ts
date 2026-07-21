import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Contract test for `TrialBalanceExporterAdapter` — [EXPORT] cluster
 * paydown. TDD RED-first. Sister of `equity-statement-exporter.adapter.test.ts`
 * — see that file's header for rationale.
 */

const { mockExportPdf, mockExportXlsx } = vi.hoisted(() => ({
  mockExportPdf: vi.fn(),
  mockExportXlsx: vi.fn(),
}));

vi.mock("../exporters/trial-balance-pdf.exporter", () => ({
  exportTrialBalancePdf: mockExportPdf,
}));

vi.mock("../exporters/trial-balance-xlsx.exporter", () => ({
  exportTrialBalanceXlsx: mockExportXlsx,
}));

import { TrialBalanceExporterAdapter } from "../adapters/trial-balance-exporter.adapter";
import type { TrialBalanceReport } from "../../domain/trial-balance.types";

const report = { orgId: "org-1" } as unknown as TrialBalanceReport;

describe("TrialBalanceExporterAdapter — implements TrialBalanceExporterPort, delegates to pure exporters", () => {
  beforeEach(() => {
    mockExportPdf.mockReset();
    mockExportXlsx.mockReset();
  });

  it("exportPdf: delegates to exportTrialBalancePdf and unwraps { buffer } to a plain Buffer", async () => {
    const pdfBuffer = Buffer.from("%PDF-1.4 fake");
    mockExportPdf.mockResolvedValue({ buffer: pdfBuffer, docDef: {} });

    const adapter = new TrialBalanceExporterAdapter();
    const result = await adapter.exportPdf(report, "Avicont SA", "12345", "La Paz", "La Paz");

    expect(result).toBe(pdfBuffer);
    expect(mockExportPdf).toHaveBeenCalledTimes(1);
    expect(mockExportPdf).toHaveBeenCalledWith(report, "Avicont SA", "12345", "La Paz", "La Paz");
  });

  it("exportXlsx: delegates to exportTrialBalanceXlsx and forwards its Buffer as-is", async () => {
    const xlsxBuffer = Buffer.from("PK fake xlsx");
    mockExportXlsx.mockResolvedValue(xlsxBuffer);

    const adapter = new TrialBalanceExporterAdapter();
    const result = await adapter.exportXlsx(report, "Avicont SA");

    expect(result).toBe(xlsxBuffer);
    expect(mockExportXlsx).toHaveBeenCalledTimes(1);
    expect(mockExportXlsx).toHaveBeenCalledWith(report, "Avicont SA", undefined, undefined);
  });
});
