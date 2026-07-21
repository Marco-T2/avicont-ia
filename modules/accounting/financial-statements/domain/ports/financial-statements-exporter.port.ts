import type { BalanceSheet, IncomeStatement } from "../types/financial-statements.types";

/**
 * Outbound port for rendering the Balance General / Estado de Resultados as
 * PDF/XLSX. [EXPORT] cluster paydown — see
 * `modules/accounting/domain/ports/ledger-exporter.port.ts` for the full
 * rationale (D4 precedent).
 *
 * UNLIKE the other 6 families, `financial-statements.service.ts` was
 * ALREADY the "known-good pattern" this whole cluster paydown generalizes:
 * it wraps every exporter call as a service method
 * (`exportBalanceSheetPdf`/`exportIncomeStatementPdf`/etc.) instead of
 * re-exporting the raw exporter from a presentation barrel. Its 2 R2
 * violations came from importing the exporter functions DIRECTLY inside
 * that service instead of through an injected port — this port fixes
 * exactly that, with zero change to the service's public method names or
 * the route.ts call sites (which already call `service.exportXxxPdf(...)`).
 *
 * `FinancialStatementsOrgHeader` mirrors the literal shape
 * `FinancialStatementsService.resolveOrgHeader()` already returns (and the
 * underlying exporter functions' `org: OrgHeaderMetadata` parameter already
 * accepts structurally) — defined locally so this port stays infra-free.
 *
 * Both `exportBalanceSheetPdf`/`exportIncomeStatementPdf` already return a
 * plain `Buffer` at the exporter-function level (financial-statements is
 * the ONE family whose PDF exporters were never "Result"-wrapped with
 * `docDef` — see design note in the cluster's exploration).
 */
export interface FinancialStatementsOrgHeader {
  name: string;
  nit: string | null;
  address: string | null;
  city: string | null;
}

export interface FinancialStatementsExporterPort {
  exportBalanceSheetPdf(
    bs: BalanceSheet,
    org: FinancialStatementsOrgHeader,
  ): Promise<Buffer>;

  exportBalanceSheetXlsx(
    bs: BalanceSheet,
    org: FinancialStatementsOrgHeader,
  ): Promise<Buffer>;

  exportIncomeStatementPdf(
    is: IncomeStatement,
    org: FinancialStatementsOrgHeader,
  ): Promise<Buffer>;

  exportIncomeStatementXlsx(
    is: IncomeStatement,
    org: FinancialStatementsOrgHeader,
  ): Promise<Buffer>;
}
