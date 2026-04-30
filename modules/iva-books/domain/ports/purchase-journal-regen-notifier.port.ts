/**
 * Cross-module notifier outbound port — IVA → purchase-hex. Wraps the
 * existing purchase-hex use case
 * `PurchaseService.regenerateJournalForIvaChange` so IVA-hex use cases
 * can trigger the purchase's journal entry to be rebuilt when the IVA
 * shape changes (POSTED+OPEN purchases only). Split simétrico con
 * `SaleJournalRegenNotifierPort`.
 *
 * **D-A1#3 lockeada** — adapter wraps the purchase-hex use case directly
 * (NO factory). Asimetría conocida con sale-hex: purchase-hex
 * `regenerateJournalForIvaChange` valida periodo INSIDE el use case
 * (líneas 1093-1099, throws `PurchasePeriodClosed`) mientras sale-hex no
 * — esa asimetría motiva D-A1#4 elevation: IVA-hex declara
 * `FiscalPeriodReaderPort` obligatorio para validar periodo en su lado y
 * cubrir ambos paths uniformemente.
 *
 * El bridge call es side-effect cross-module — purchase-hex maneja su
 * propia tx via `PurchaseUoW.run()`, no comparte tx con `IvaBookScope`
 * (paralelo `SaleJournalRegenNotifierPort` + D-1 lockeada).
 *
 * Returns `{ correlationId }` narrow — IVA-hex no consume el `Purchase`
 * resultante (cross-module concrete leak evitado per §12).
 */
export interface PurchaseJournalRegenNotifierPort {
  /**
   * Triggers purchase-hex to regenerate the journal entry reflecting the
   * new IVA shape. Returns the correlation id of the purchase-hex run
   * for audit chaining.
   */
  regenerateJournalForIvaChange(
    organizationId: string,
    purchaseId: string,
    userId: string,
  ): Promise<{ correlationId: string }>;
}
