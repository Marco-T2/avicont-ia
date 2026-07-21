import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Contract test for `VoucherPdfExporterAdapter` — [EXPORT] cluster paydown,
 * voucher family (the 4 deferred `journals.service.ts:R2` violations).
 * Mirrors `financial-statements-exporter.adapter.test.ts`: the underlying
 * pure helpers are mocked, the test pins the DELEGATION pipeline
 * (logo fetch → compose → render) and the argument forwarding; real
 * rendering stays pinned by the exporter/composer unit tests.
 */

const { mockFetchLogo, mockBuildInput, mockRender } = vi.hoisted(() => ({
  mockFetchLogo: vi.fn(),
  mockBuildInput: vi.fn(),
  mockRender: vi.fn(),
}));

vi.mock("../exporters/logo-fetcher", () => ({
  fetchLogoAsDataUrl: mockFetchLogo,
}));

vi.mock("../exporters/voucher-pdf.composer", () => ({
  buildVoucherPdfInput: mockBuildInput,
}));

vi.mock("../exporters/voucher-pdf.exporter", () => ({
  exportVoucherPdf: mockRender,
}));

import { VoucherPdfExporterAdapter } from "../adapters/voucher-pdf-exporter.adapter";
import type { VoucherPdfExportInput } from "../../domain/ports/voucher-pdf-exporter.port";

const input = {
  entry: { id: "je-1" },
  profile: { razonSocial: "ACME SRL", logoUrl: "https://blob/logo.png" },
  sigConfig: { documentType: "COMPROBANTE", labels: [], showReceiverRow: false },
  logoUrl: "https://blob/logo.png",
  exchangeRate: 6.96,
  ufvRate: "2.35",
  gestion: "Agosto 2025",
  locality: "La Paz",
} as unknown as VoucherPdfExportInput;

describe("VoucherPdfExporterAdapter — implements VoucherPdfExporterPort, delegates to the pure pipeline", () => {
  beforeEach(() => {
    mockFetchLogo.mockReset();
    mockBuildInput.mockReset();
    mockRender.mockReset();
  });

  it("exportPdf: fetches the logo, composes with the forwarded args, and returns the renderer's Buffer as-is", async () => {
    const composed = { voucher: "composed" };
    const buffer = Buffer.from("%PDF-1.4 fake");
    mockFetchLogo.mockResolvedValue("data:image/png;base64,AAA");
    mockBuildInput.mockReturnValue(composed);
    mockRender.mockResolvedValue(buffer);

    const result = await new VoucherPdfExporterAdapter().exportPdf(input);

    expect(mockFetchLogo).toHaveBeenCalledWith("https://blob/logo.png");
    expect(mockBuildInput).toHaveBeenCalledWith(
      input.entry,
      input.profile,
      input.sigConfig,
      "data:image/png;base64,AAA",
      {
        exchangeRate: 6.96,
        ufvRate: "2.35",
        gestion: "Agosto 2025",
        locality: "La Paz",
      },
    );
    expect(mockRender).toHaveBeenCalledWith(composed);
    expect(result).toBe(buffer);
  });

  it("exportPdf: forwards an undefined logo data-url (no-logo branch stays with the composer)", async () => {
    mockFetchLogo.mockResolvedValue(undefined);
    mockBuildInput.mockReturnValue({});
    mockRender.mockResolvedValue(Buffer.from("x"));

    await new VoucherPdfExporterAdapter().exportPdf({
      ...input,
      logoUrl: null,
    });

    expect(mockFetchLogo).toHaveBeenCalledWith(null);
    expect(mockBuildInput.mock.calls[0][3]).toBeUndefined();
  });
});
