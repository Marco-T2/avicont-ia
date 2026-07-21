import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Contract test for `LedgerExporterAdapter` — [EXPORT] cluster paydown.
 * TDD RED-first: written before the adapter exists. Asserts the adapter
 * implements `LedgerExporterPort` by delegating to the EXISTING pure
 * exporter functions (`exportLedgerPdf`/`exportLedgerXlsx`, left unchanged)
 * and unwrapping the PDF exporter's `{ buffer, docDef }` Result down to a
 * plain `Buffer` at the port boundary (no production caller ever used
 * `docDef`).
 */

const { mockExportLedgerPdf, mockExportLedgerXlsx } = vi.hoisted(() => ({
  mockExportLedgerPdf: vi.fn(),
  mockExportLedgerXlsx: vi.fn(),
}));

vi.mock("../exporters/ledger/ledger-pdf.exporter", () => ({
  exportLedgerPdf: mockExportLedgerPdf,
}));

vi.mock("../exporters/ledger/ledger-xlsx.exporter", () => ({
  exportLedgerXlsx: mockExportLedgerXlsx,
}));

import { LedgerExporterAdapter } from "../adapters/ledger-exporter.adapter";
import type { LedgerEntry } from "../../domain/ledger.types";

const entries: LedgerEntry[] = [
  {
    entryId: "je-1",
    date: new Date("2025-01-15"),
    entryNumber: 1,
    voucherCode: "CD",
    description: "Venta",
    debit: "100.00",
    credit: "0.00",
    balance: "100.00",
  },
];

const opts = {
  accountCode: "1.1.01",
  accountName: "Caja",
  dateFrom: "2025-01-01",
  dateTo: "2025-01-31",
  openingBalance: "0.00",
};

describe("LedgerExporterAdapter — implements LedgerExporterPort, delegates to pure exporters", () => {
  beforeEach(() => {
    mockExportLedgerPdf.mockReset();
    mockExportLedgerXlsx.mockReset();
  });

  it("exportPdf: delegates to exportLedgerPdf and unwraps { buffer } to a plain Buffer", async () => {
    const pdfBuffer = Buffer.from("%PDF-1.4 fake");
    mockExportLedgerPdf.mockResolvedValue({ buffer: pdfBuffer, docDef: {} });

    const adapter = new LedgerExporterAdapter();
    const result = await adapter.exportPdf(entries, opts, "Avicont SA", "12345", "La Paz", "La Paz");

    expect(result).toBe(pdfBuffer);
    expect(mockExportLedgerPdf).toHaveBeenCalledTimes(1);
    expect(mockExportLedgerPdf).toHaveBeenCalledWith(
      entries,
      opts,
      "Avicont SA",
      "12345",
      "La Paz",
      "La Paz",
    );
  });

  it("exportXlsx: delegates to exportLedgerXlsx and forwards its Buffer as-is", async () => {
    const xlsxBuffer = Buffer.from("PK fake xlsx");
    mockExportLedgerXlsx.mockResolvedValue(xlsxBuffer);

    const adapter = new LedgerExporterAdapter();
    const result = await adapter.exportXlsx(entries, opts, "Avicont SA");

    expect(result).toBe(xlsxBuffer);
    expect(mockExportLedgerXlsx).toHaveBeenCalledTimes(1);
    expect(mockExportLedgerXlsx).toHaveBeenCalledWith(
      entries,
      opts,
      "Avicont SA",
      undefined,
      undefined,
      undefined,
    );
  });
});
