import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Contract test for `ContactLedgerExporterAdapter` — [EXPORT] cluster
 * paydown. TDD RED-first. Sister of `ledger-exporter.adapter.test.ts` — see
 * that file's header for rationale.
 */

const { mockExportContactLedgerPdf, mockExportContactLedgerXlsx } = vi.hoisted(() => ({
  mockExportContactLedgerPdf: vi.fn(),
  mockExportContactLedgerXlsx: vi.fn(),
}));

vi.mock("../exporters/contact-ledger/contact-ledger-pdf.exporter", () => ({
  exportContactLedgerPdf: mockExportContactLedgerPdf,
}));

vi.mock("../exporters/contact-ledger/contact-ledger-xlsx.exporter", () => ({
  exportContactLedgerXlsx: mockExportContactLedgerXlsx,
}));

import { ContactLedgerExporterAdapter } from "../adapters/contact-ledger-exporter.adapter";
import type { ContactLedgerEntry } from "../../domain/ledger.types";

const entries: ContactLedgerEntry[] = [
  {
    entryId: "je-1",
    date: new Date("2025-01-15"),
    entryNumber: 1,
    voucherCode: "CD",
    description: "Venta",
    debit: "100.00",
    credit: "0.00",
    balance: "100.00",
    status: "PENDING",
    dueDate: null,
    voucherTypeHuman: "Nota de despacho",
    sourceType: "sale",
    paymentMethod: null,
    bankAccountName: null,
    paymentDirection: null,
    documentTypeCode: null,
    documentReferenceNumber: null,
    withoutAuxiliary: false,
  },
];

const opts = {
  contactName: "Distribuidora ACME",
  dateFrom: "2025-01-01",
  dateTo: "2025-01-31",
  openingBalance: "0.00",
};

describe("ContactLedgerExporterAdapter — implements ContactLedgerExporterPort, delegates to pure exporters", () => {
  beforeEach(() => {
    mockExportContactLedgerPdf.mockReset();
    mockExportContactLedgerXlsx.mockReset();
  });

  it("exportPdf: delegates to exportContactLedgerPdf and unwraps { buffer } to a plain Buffer", async () => {
    const pdfBuffer = Buffer.from("%PDF-1.4 fake");
    mockExportContactLedgerPdf.mockResolvedValue({ buffer: pdfBuffer, docDef: {} });

    const adapter = new ContactLedgerExporterAdapter();
    const result = await adapter.exportPdf(entries, opts, "Avicont SA", "12345", "La Paz", "La Paz");

    expect(result).toBe(pdfBuffer);
    expect(mockExportContactLedgerPdf).toHaveBeenCalledTimes(1);
    expect(mockExportContactLedgerPdf).toHaveBeenCalledWith(
      entries,
      opts,
      "Avicont SA",
      "12345",
      "La Paz",
      "La Paz",
    );
  });

  it("exportXlsx: delegates to exportContactLedgerXlsx and forwards its Buffer as-is", async () => {
    const xlsxBuffer = Buffer.from("PK fake xlsx");
    mockExportContactLedgerXlsx.mockResolvedValue(xlsxBuffer);

    const adapter = new ContactLedgerExporterAdapter();
    const result = await adapter.exportXlsx(entries, opts, "Avicont SA");

    expect(result).toBe(xlsxBuffer);
    expect(mockExportContactLedgerXlsx).toHaveBeenCalledTimes(1);
    expect(mockExportContactLedgerXlsx).toHaveBeenCalledWith(
      entries,
      opts,
      "Avicont SA",
      undefined,
      undefined,
      undefined,
    );
  });
});
