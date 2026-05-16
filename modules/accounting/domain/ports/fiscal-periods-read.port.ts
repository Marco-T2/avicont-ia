/**
 * Narrow read-only snapshot of a fiscal period as seen by the journal use
 * cases. Carries `id`, `status`, `name`, y el rango `[startDate, endDate]` para
 * que el invariante I12 (date∈período) pueda chequearse sin un segundo round-trip.
 * Defined locally — port does not import from `modules/fiscal-periods/...`.
 *
 * Cross-module note: shape parcialmente paralela a
 * `modules/payment/domain/ports/fiscal-periods-read.port.ts:PaymentFiscalPeriod`
 * (que solo carga id+status). Candidate for promotion to `modules/shared/domain/ports/`
 * con esta misma shape ampliada una vez que IVA u otro consumer la pida (POC #11).
 */
export interface AccountingFiscalPeriod {
  id: string;
  status: "OPEN" | "CLOSED";
  name: string;
  startDate: Date;
  endDate: Date;
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
