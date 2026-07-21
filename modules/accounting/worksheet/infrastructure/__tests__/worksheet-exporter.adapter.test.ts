import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Contract test for `WorksheetExporterAdapter` — [EXPORT] cluster paydown.
 * TDD RED-first. Sister of `equity-statement-exporter.adapter.test.ts` — see
 * that file's header for rationale.
 *
 * `exportXlsx` takes only `(report, orgName)` — mirrors the narrower
 * `exportWorksheetXlsx` signature exactly (see `worksheet-exporter.port.ts`).
 */

const { mockExportPdf, mockExportXlsx } = vi.hoisted(() => ({
  mockExportPdf: vi.fn(),
  mockExportXlsx: vi.fn(),
}));

vi.mock("../exporters/worksheet-pdf.exporter", () => ({
  exportWorksheetPdf: mockExportPdf,
}));

vi.mock("../exporters/worksheet-xlsx.exporter", () => ({
  exportWorksheetXlsx: mockExportXlsx,
}));

import { WorksheetExporterAdapter } from "../adapters/worksheet-exporter.adapter";
import type { WorksheetReport } from "../../domain/worksheet.types";

const report = { orgId: "org-1" } as unknown as WorksheetReport;

describe("WorksheetExporterAdapter — implements WorksheetExporterPort, delegates to pure exporters", () => {
  beforeEach(() => {
    mockExportPdf.mockReset();
    mockExportXlsx.mockReset();
  });

  it("exportPdf: delegates to exportWorksheetPdf and unwraps { buffer } to a plain Buffer", async () => {
    const pdfBuffer = Buffer.from("%PDF-1.4 fake");
    mockExportPdf.mockResolvedValue({ buffer: pdfBuffer, docDef: {} });

    const adapter = new WorksheetExporterAdapter();
    const result = await adapter.exportPdf(report, "Avicont SA", "12345", "La Paz", "La Paz");

    expect(result).toBe(pdfBuffer);
    expect(mockExportPdf).toHaveBeenCalledTimes(1);
    expect(mockExportPdf).toHaveBeenCalledWith(report, "Avicont SA", "12345", "La Paz", "La Paz");
  });

  it("exportXlsx: delegates to exportWorksheetXlsx(report, orgName) and forwards its Buffer as-is", async () => {
    const xlsxBuffer = Buffer.from("PK fake xlsx");
    mockExportXlsx.mockResolvedValue(xlsxBuffer);

    const adapter = new WorksheetExporterAdapter();
    const result = await adapter.exportXlsx(report, "acme-slug");

    expect(result).toBe(xlsxBuffer);
    expect(mockExportXlsx).toHaveBeenCalledTimes(1);
    expect(mockExportXlsx).toHaveBeenCalledWith(report, "acme-slug");
  });
});
