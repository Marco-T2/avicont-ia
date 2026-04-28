/**
 * Narrow read-only snapshot of a fiscal period as seen by the payment
 * orchestrator. Only carries what payment use cases actually inspect:
 * `id` and `status` (OPEN/CLOSED). Defined locally so this port does not
 * import from `modules/fiscal-periods/...`.
 */
export interface PaymentFiscalPeriod {
  id: string;
  status: "OPEN" | "CLOSED";
}

/**
 * Read-only port for fiscal periods. Non-tx — legacy reads the period before
 * entering the transaction (see `payment.service.ts` line 116). The adapter
 * MUST throw NotFoundError when the period does not exist (legacy parity).
 */
export interface FiscalPeriodsReadPort {
  getById(organizationId: string, id: string): Promise<PaymentFiscalPeriod>;
}
