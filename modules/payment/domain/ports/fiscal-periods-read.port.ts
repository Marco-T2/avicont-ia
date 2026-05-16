/**
 * Narrow read-only snapshot of a fiscal period as seen by the payment
 * orchestrator. Carries `id`, `status` y el rango `[startDate, endDate]` + `name`
 * para que el invariante I12 (date∈período) pueda chequearse sin un segundo
 * round-trip. Defined locally so this port does not import from `modules/fiscal-periods/...`.
 *
 * Cross-module note: shape ampliada en paralelo a
 * `modules/accounting/domain/ports/fiscal-periods-read.port.ts:AccountingFiscalPeriod`.
 * Candidate para promoción a `modules/shared/domain/ports/` con un tercer consumer
 * que requiera la misma shape (IVA en POC #11).
 */
export interface PaymentFiscalPeriod {
  id: string;
  status: "OPEN" | "CLOSED";
  name: string;
  startDate: Date;
  endDate: Date;
}

/**
 * Read-only port for fiscal periods. Non-tx — legacy reads the period before
 * entering the transaction (see `payment.service.ts` line 116). The adapter
 * MUST throw NotFoundError when the period does not exist (legacy parity).
 */
export interface FiscalPeriodsReadPort {
  getById(organizationId: string, id: string): Promise<PaymentFiscalPeriod>;
}
