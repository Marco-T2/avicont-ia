import type { JournalEntryWithLines } from "../journal.types";
import type { OrgProfileSnapshot } from "@/modules/org-profile/domain/org-profile.entity";
import type {
  DocumentPrintType,
  SignatureLabel,
} from "@/modules/document-signature-config/domain/document-signature-config.entity";

/**
 * Outbound port for rendering a journal entry as the Comprobante (voucher)
 * PDF. [EXPORT] cluster paydown, final family — see
 * `modules/accounting/domain/ports/ledger-exporter.port.ts` for the full
 * rationale (D4 precedent) and
 * `modules/accounting/financial-statements/domain/ports/
 * financial-statements-exporter.port.ts` for the injected-port service shape
 * this mirrors.
 *
 * `JournalsService.exportVoucherPdf` used to import the three pure exporter
 * helpers (`fetchLogoAsDataUrl` → `buildVoucherPdfInput` →
 * `exportVoucherPdf`) DIRECTLY from `infrastructure/exporters/` — the 4
 * deferred `journals.service.ts:R2` violations this port closes. The service
 * KEEPS the domain-data orchestration (entry / org profile / signature
 * config / fiscal period for the gestión name); the port hides the
 * logo-fetch + compose + pdfmake-render pipeline behind ONE method,
 * implemented by `infrastructure/adapters/voucher-pdf-exporter.adapter.ts`
 * as a thin delegation to the EXISTING pure functions (left unchanged —
 * zero risk to rendering logic).
 *
 * `VoucherSignatureConfigView` mirrors the literal shape
 * `DocumentSignatureConfigService.getOrDefault()` returns
 * (`DocumentSignatureConfigView` is declared in that module's application/
 * layer, which domain may not import — R1) — defined locally from that
 * module's DOMAIN label types so this port stays infra/application-free,
 * the same move as `FinancialStatementsOrgHeader` in the fin-statements
 * port.
 */

/**
 * Caller-supplied render options for the voucher PDF (exchange/UFV rates
 * typed by the user in the print dialog). Moved here from
 * `infrastructure/exporters/voucher-pdf.types.ts` (a back-compat re-export
 * remains there) so the application service imports it from domain.
 */
export type ExportVoucherOpts = {
  exchangeRate?: number;
  ufvRate?: string;
};

/** Local structural mirror of `DocumentSignatureConfigView` — see header. */
export interface VoucherSignatureConfigView {
  documentType: DocumentPrintType;
  labels: SignatureLabel[];
  showReceiverRow: boolean;
}

/**
 * Everything the infra pipeline needs, resolved by the application service:
 * the entry + org profile + signature config (domain-owned shapes), the raw
 * `logoUrl` (the adapter fetches/encodes it), the user opts, and the two
 * service-derived scalars (`gestion` = fiscal period name, `locality` =
 * profile city).
 */
export interface VoucherPdfExportInput {
  entry: JournalEntryWithLines;
  profile: OrgProfileSnapshot;
  sigConfig: VoucherSignatureConfigView;
  logoUrl: string | null;
  exchangeRate?: number;
  ufvRate?: string;
  gestion: string;
  locality: string;
}

export interface VoucherPdfExporterPort {
  exportPdf(input: VoucherPdfExportInput): Promise<Buffer>;
}
