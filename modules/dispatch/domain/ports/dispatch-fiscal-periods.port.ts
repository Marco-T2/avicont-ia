/**
 * Outbound port for fiscal period validation from dispatch-hex use cases.
 * Returns period status for open/closed validation.
 */
export interface DispatchFiscalPeriod {
  id: string;
  name: string;
  status: string;
}

export interface DispatchFiscalPeriodsPort {
  getById(
    organizationId: string,
    periodId: string,
  ): Promise<DispatchFiscalPeriod>;
}
