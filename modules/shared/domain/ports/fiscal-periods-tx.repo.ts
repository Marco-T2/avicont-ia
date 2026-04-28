/**
 * Tx-bound port for fiscal_periods writes that must run inside a UnitOfWork.
 *
 * The implementation is held by `UnitOfWorkScope` and is constructed by the
 * UoW adapter against the open transaction — consumers never see a `tx`
 * token themselves.
 *
 * Mirrors the behaviour of the legacy
 * `MonthlyCloseRepository.markPeriodClosed(tx, orgId, periodId, userId)`
 * (`features/monthly-close/monthly-close.repository.ts`). When the future
 * monthly-close POC migrates to hexagonal, this port is the destination.
 */
export interface FiscalPeriodsTxRepo {
  /**
   * Closes the given period: status -> CLOSED, closedAt -> now, closedBy -> userId.
   * The audit row is written automatically by the `audit_fiscal_periods` PL/pgSQL
   * trigger; this method does NOT touch `audit_logs`.
   */
  markClosed(
    organizationId: string,
    periodId: string,
    userId: string,
  ): Promise<{ closedAt: Date; closedBy: string }>;
}
