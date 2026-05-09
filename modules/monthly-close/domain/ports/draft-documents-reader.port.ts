/**
 * Read-only port for cross-entity DRAFT document counts consumed by
 * monthly-close orchestrator pre-TX guard `validateCanClose`. Outside-scope
 * read-only mirror sale `IvaBookReaderPort` precedent EXACT (NO tx-bound,
 * pre-TX read aligned con driver real
 * `features/monthly-close/monthly-close.service.ts:42-69 +
 * monthly-close.repository.ts:57-89` `Promise.all` 5 entities cross-entity
 * single concern: draft counts).
 *
 * **Snapshot LOCAL primitive-typed §13 9na evidencia D1 cementación
 * cumulative cross-module** — `MonthlyCloseDraftCounts` mirror C1
 * `MonthlyCloseFiscalPeriod` precedent EXACT primitive-typed (paired sister
 * §13 #1655 + iva-books `IvaFiscalPeriod`). NO 5 split anticipatorio YAGNI
 * (driver shape único método retorna 5-count shape — single port
 * driver-anchored consumer-driven hex monthly-close OWNS).
 */
export interface MonthlyCloseDraftCounts {
  dispatches: number;
  payments: number;
  journalEntries: number;
  sales: number;
  purchases: number;
}

export interface DraftDocumentsReaderPort {
  countDraftsByPeriod(
    organizationId: string,
    periodId: string,
  ): Promise<MonthlyCloseDraftCounts>;
}
