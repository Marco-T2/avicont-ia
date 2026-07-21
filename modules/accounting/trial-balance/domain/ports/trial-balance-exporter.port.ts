import type { TrialBalanceReport } from "../trial-balance.types";

/**
 * Outbound port for rendering the Balance de Comprobación de Sumas y Saldos
 * as PDF/XLSX. [EXPORT] cluster paydown — see
 * `modules/accounting/domain/ports/ledger-exporter.port.ts` for the full
 * rationale (D4 precedent, docDef-drop reasoning).
 *
 * `exportPdf` returns a plain `Buffer` — the underlying exporter function
 * (`exportTrialBalancePdf`) still returns `{ buffer, docDef }` for
 * testing/inspection (unchanged); no production caller used `docDef`
 * (route.ts only destructured `{ buffer }`), so the adapter unwraps it.
 */
export interface TrialBalanceExporterPort {
  exportPdf(
    report: TrialBalanceReport,
    orgName: string,
    orgNit?: string,
    orgAddress?: string,
    orgCity?: string,
  ): Promise<Buffer>;

  exportXlsx(
    report: TrialBalanceReport,
    orgName: string,
    orgNit?: string,
    orgAddress?: string,
  ): Promise<Buffer>;
}
