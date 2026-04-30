/**
 * Cross-module notifier outbound port — IVA → sale-hex. Wraps the existing
 * sale-hex use case `SaleService.regenerateJournalForIvaChange` so IVA-hex
 * use cases (regenerate / recompute / void / reactivate) can trigger the
 * sale's journal entry to be rebuilt when the IVA shape changes (POSTED+OPEN
 * sales only).
 *
 * **D-A1#3 lockeada** — adapter wraps the sale-hex use case directly (NO
 * factory). El sale-hex use case ya maneja su propia tx vía `SaleUoW.run()`
 * — desde la perspectiva de IVA-hex el bridge call es un side-effect
 * cross-module, no comparte tx con `IvaBookScope`. La asimetría con
 * `applyVoidCascade` (que SÍ comparte tx via F-α scope-passing) es
 * intencional: regenerate journal sale es un flujo independiente del IVA
 * write — sale-hex falla → la sale entity quedó coherente, pero el IVA
 * write no se revierte (D-1 lockeada en bookmark scope-locked POC #11.0c).
 *
 * Returns `{ correlationId }` narrow — IVA-hex no consume el `Sale`
 * resultante (cross-module concrete leak evitado per §12). El adapter A3
 * proyecta `UpdateSaleResult = { sale, correlationId }` → `{ correlationId }`.
 */
export interface SaleJournalRegenNotifierPort {
  /**
   * Triggers sale-hex to regenerate the journal entry reflecting the new
   * IVA shape. Returns the correlation id of the sale-hex run for
   * audit chaining.
   */
  regenerateJournalForIvaChange(
    organizationId: string,
    saleId: string,
    userId: string,
  ): Promise<{ correlationId: string }>;
}
