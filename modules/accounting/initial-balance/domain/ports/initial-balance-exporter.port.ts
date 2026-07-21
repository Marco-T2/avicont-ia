import type { InitialBalanceStatement } from "../initial-balance.types";

/**
 * Outbound port for rendering the Balance Inicial as PDF/XLSX. [EXPORT]
 * cluster paydown — see
 * `modules/accounting/domain/ports/ledger-exporter.port.ts` for the full
 * rationale (D4 precedent, docDef-drop reasoning).
 *
 * Both methods take only `statement` — org header metadata is already
 * embedded in `InitialBalanceStatement.org` (unlike the other 5 families,
 * which take orgName/orgNit/orgAddress/orgCity as separate params), mirroring
 * the underlying exporter functions' signatures exactly.
 *
 * `exportPdf` returns a plain `Buffer` — the underlying exporter function
 * (`exportInitialBalancePdf`) still returns `{ buffer, docDef }` for
 * testing/inspection (unchanged); no production caller used `docDef`.
 */
export interface InitialBalanceExporterPort {
  exportPdf(statement: InitialBalanceStatement): Promise<Buffer>;
  exportXlsx(statement: InitialBalanceStatement): Promise<Buffer>;
}
