import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Contract test for `EquityStatementExporterAdapter` — [EXPORT] cluster
 * paydown. TDD RED-first: written before the adapter exists. Asserts the
 * adapter implements `EquityStatementExporterPort` by delegating to the
 * EXISTING pure exporter functions (left unchanged) and unwrapping the PDF
 * exporter's `{ buffer, docDef }` Result to a plain `Buffer`.
 */

const { mockExportPdf, mockExportXlsx } = vi.hoisted(() => ({
  mockExportPdf: vi.fn(),
  mockExportXlsx: vi.fn(),
}));

vi.mock("../exporters/equity-statement-pdf.exporter", () => ({
  exportEquityStatementPdf: mockExportPdf,
}));

vi.mock("../exporters/equity-statement-xlsx.exporter", () => ({
  exportEquityStatementXlsx: mockExportXlsx,
}));

import { EquityStatementExporterAdapter } from "../adapters/equity-statement-exporter.adapter";
import type { EquityStatement } from "../../domain/equity-statement.types";

const statement = { orgId: "org-1" } as unknown as EquityStatement;

describe("EquityStatementExporterAdapter — implements EquityStatementExporterPort, delegates to pure exporters", () => {
  beforeEach(() => {
    mockExportPdf.mockReset();
    mockExportXlsx.mockReset();
  });

  it("exportPdf: delegates to exportEquityStatementPdf and unwraps { buffer } to a plain Buffer", async () => {
    const pdfBuffer = Buffer.from("%PDF-1.4 fake");
    mockExportPdf.mockResolvedValue({ buffer: pdfBuffer, docDef: {} });

    const adapter = new EquityStatementExporterAdapter();
    const result = await adapter.exportPdf(statement, "Avicont SA", "12345", "La Paz", "La Paz");

    expect(result).toBe(pdfBuffer);
    expect(mockExportPdf).toHaveBeenCalledTimes(1);
    expect(mockExportPdf).toHaveBeenCalledWith(statement, "Avicont SA", "12345", "La Paz", "La Paz");
  });

  it("exportXlsx: delegates to exportEquityStatementXlsx and forwards its Buffer as-is", async () => {
    const xlsxBuffer = Buffer.from("PK fake xlsx");
    mockExportXlsx.mockResolvedValue(xlsxBuffer);

    const adapter = new EquityStatementExporterAdapter();
    const result = await adapter.exportXlsx(statement, "Avicont SA");

    expect(result).toBe(xlsxBuffer);
    expect(mockExportXlsx).toHaveBeenCalledTimes(1);
    expect(mockExportXlsx).toHaveBeenCalledWith(statement, "Avicont SA", undefined, undefined);
  });
});
