/**
 * Cross-module reader outbound port — IVA → purchase. Read-only narrow
 * snapshot of a `Purchase` aggregate as seen by IVA-hex use cases
 * (cold-verify shape al consumir per scope-locked-bookmark POC #11.0c A2).
 * Lives OUTSIDE `IvaBookScope` — resuelve antes de que la UoW tx abra
 * (paridad con `FiscalPeriodReaderPort` + `SaleReaderPort` simétrico).
 *
 * Definido localmente para no cruzar boundary §12 importando `Purchase`
 * entity cross-module. El shape `PurchaseSnapshot` carga sólo los campos
 * que los use cases A2 realmente inspeccionan — emerge durante consumption
 * Ciclo 3+ (RED honesty preventivo).
 */
export interface PurchaseSnapshot {
  id: string;
  organizationId: string;
  /**
   * Purchase status — Prisma `PurchaseStatus` schema parity (4 valores,
   * schema:521-526). Bridge gate: only `POSTED` triggers
   * `PurchaseJournalRegenNotifier.regenerateJournalForIvaChange`
   * (DRAFT/LOCKED/VOIDED skip). LOCKED widened POC #11.0c A3 pre-C1
   * (aspirational_mock_signal — port honra el contrato real del adapter Prisma,
   * que emite los 4 enum values).
   */
  status: "DRAFT" | "POSTED" | "LOCKED" | "VOIDED";
}

export interface PurchaseReaderPort {
  /**
   * Returns the purchase snapshot, or `null` when the purchase does not
   * exist. Non-tx — resuelve antes de que la UoW tx abra.
   */
  getById(
    organizationId: string,
    purchaseId: string,
  ): Promise<PurchaseSnapshot | null>;
}
