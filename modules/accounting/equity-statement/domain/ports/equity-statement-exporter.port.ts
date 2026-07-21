import type { EquityStatement } from "../equity-statement.types";

/**
 * Outbound port for rendering the Estado de Evolución del Patrimonio Neto
 * (EEPN) as PDF/XLSX. [EXPORT] cluster paydown — see
 * `modules/accounting/domain/ports/ledger-exporter.port.ts` for the full
 * rationale (D4 precedent, docDef-drop reasoning).
 *
 * `exportPdf` returns a plain `Buffer` — the underlying exporter function
 * (`exportEquityStatementPdf`) still returns `{ buffer, docDef }` for
 * testing/inspection (unchanged); no production caller used `docDef`
 * (route.ts only destructured `{ buffer }`), so the adapter unwraps it.
 */
export interface EquityStatementExporterPort {
  exportPdf(
    statement: EquityStatement,
    orgName: string,
    orgNit?: string,
    orgAddress?: string,
    orgCity?: string,
  ): Promise<Buffer>;

  exportXlsx(
    statement: EquityStatement,
    orgName: string,
    orgNit?: string,
    orgAddress?: string,
  ): Promise<Buffer>;
}
