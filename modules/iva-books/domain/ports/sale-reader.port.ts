/**
 * Cross-module reader outbound port — IVA → sale. Read-only narrow snapshot
 * of a `Sale` aggregate as seen by IVA-hex use cases (cold-verify shape al
 * consumir per scope-locked-bookmark POC #11.0c A2). Lives OUTSIDE
 * `IvaBookScope` — resuelve antes de que la UoW tx abra (parity con
 * `FiscalPeriodReaderPort` y los `*-reader` ports en sale/purchase-hex).
 *
 * Definido localmente para no cruzar boundary §12 importando `Sale` entity
 * cross-module. El shape `SaleSnapshot` carga sólo los campos que los use
 * cases A2 (regenerate / recompute / void / reactivate / applyVoidCascade)
 * realmente inspeccionan — emerge durante consumption Ciclo 3+ (RED honesty
 * preventivo: agregar campo SI un test lo requiere, no preventivamente).
 *
 * Adapter A3 mapea `Sale` aggregate → `SaleSnapshot` (projection narrow,
 * paralelo con `AccountingFiscalPeriod` mapping en accounting/infrastructure).
 */
export interface SaleSnapshot {
  id: string;
  organizationId: string;
  /**
   * Sale status — used to gate bridge invocation (POSTED+OPEN triggers
   * `SaleJournalRegenNotifier.regenerateJournalForIvaChange`, DRAFT no).
   */
  status: "DRAFT" | "POSTED" | "VOIDED";
}

export interface SaleReaderPort {
  /**
   * Returns the sale snapshot, or `null` when the sale does not exist.
   * Non-tx — resuelve antes de que la UoW tx abra.
   */
  getById(
    organizationId: string,
    saleId: string,
  ): Promise<SaleSnapshot | null>;
}
