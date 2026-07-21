import type {
  VoucherPdfExportInput,
  VoucherPdfExporterPort,
} from "../../domain/ports/voucher-pdf-exporter.port";
import { fetchLogoAsDataUrl } from "../exporters/logo-fetcher";
import { buildVoucherPdfInput } from "../exporters/voucher-pdf.composer";
import { exportVoucherPdf as renderVoucherPdf } from "../exporters/voucher-pdf.exporter";

/**
 * Adapter for `VoucherPdfExporterPort` — [EXPORT] cluster paydown, voucher
 * family (the 4 deferred `journals.service.ts:R2` violations). Thin
 * delegation to the EXISTING pure exporter helpers (left UNCHANGED): logo
 * fetch → compose typed PDF input → pdfmake render. The pipeline is
 * verbatim the tail of the old `JournalsService.exportVoucherPdf`, which
 * now receives this adapter through the port via the composition root.
 */
export class VoucherPdfExporterAdapter implements VoucherPdfExporterPort {
  async exportPdf(input: VoucherPdfExportInput): Promise<Buffer> {
    const logoDataUrl = await fetchLogoAsDataUrl(input.logoUrl);
    const pdfInput = buildVoucherPdfInput(
      input.entry,
      input.profile,
      input.sigConfig,
      logoDataUrl,
      {
        exchangeRate: input.exchangeRate,
        ufvRate: input.ufvRate,
        gestion: input.gestion,
        locality: input.locality,
      },
    );
    return renderVoucherPdf(pdfInput);
  }
}
