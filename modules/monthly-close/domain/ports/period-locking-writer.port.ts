/**
 * Tx-bound port for period locking cascade INSIDE-TX consumed by
 * monthly-close orchestrator close use case. 5 methods cross-entity
 * `lockDispatches/lockPayments/lockJournalEntries/lockSales/lockPurchases`
 * driver shape EXACT mirror `features/monthly-close/monthly-close.repository.ts:135-216`
 * (5 separate `updateMany {status: POSTED → LOCKED}` mismo class boundary —
 * consumer-driven hex monthly-close OWNS, NO 5 cross-module ports split
 * anticipatorio YAGNI). Lock cascade STRICT ORDER preserved at consumer
 * service-level (`features/monthly-close/monthly-close.service.ts:206-210`
 * Dispatch → Payment → JournalEntry → Sale → Purchase secuencial — port
 * NO impone orden, service-level orchestration responsibility C2.2).
 *
 * **Tx-bound scope-membership pattern §13 cross-module hex 4ta evidencia
 * matures cumulative cross-module** (sale `journalEntries` + accounting
 * `accountBalances` + purchase + iva-books + monthly-close
 * `locking: PeriodLockingWriterPort` C2.1 NEW). Methods NO `tx` parameter en
 * signature (R5 NO Prisma leak — tx context EXCLUSIVE via UoW scope-membership,
 * adapter C3 wraps tx-bound implementación dentro `MonthlyCloseScope.locking`
 * vía `prisma.$transaction(cb)` callback — port permanece domain pure).
 *
 * **§13 NEW sub-evidencia variant Writer port primitive-return cross-entity
 * 1ra evidencia POC monthly-close** D1 cementación — paired sister §13 #1655
 * Reader port primitive-typed Snapshot LOCAL + C1 VO-typed Money variant.
 * 5 methods retornan `Promise<number>` lock count primitive (driver shape
 * EXACT `result.count` updateMany).
 */
export interface PeriodLockingWriterPort {
  lockDispatches(organizationId: string, periodId: string): Promise<number>;
  lockPayments(organizationId: string, periodId: string): Promise<number>;
  lockJournalEntries(organizationId: string, periodId: string): Promise<number>;
  lockSales(organizationId: string, periodId: string): Promise<number>;
  lockPurchases(organizationId: string, periodId: string): Promise<number>;
}
