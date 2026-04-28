/**
 * Narrow read-only snapshot of a fiscal period as seen by the journal use
 * cases. Carries `id` and `status`. Defined locally — port does not import
 * from `modules/fiscal-periods/...`.
 *
 * Cross-module note: identical shape to
 * `modules/payment/domain/ports/fiscal-periods-read.port.ts:PaymentFiscalPeriod`.
 * Candidate for promotion to `modules/shared/domain/ports/` once a third
 * consumer with the same semantics appears (rule of three — likely IVA in
 * POC #11).
 */
export interface AccountingFiscalPeriod {
  id: string;
  status: "OPEN" | "CLOSED";
}

/**
 * Read-only port for fiscal periods. Non-tx — period is read before the UoW
 * tx opens (parity with legacy `periodsService.getById` calls). The adapter
 * MUST throw NotFoundError when the period does not exist.
 */
export interface FiscalPeriodsReadPort {
  getById(
    organizationId: string,
    periodId: string,
  ): Promise<AccountingFiscalPeriod>;
}
