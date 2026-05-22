/**
 * Outbound port for fiscal period validation from dispatch-hex use cases.
 * Returns period status, name y rango `[startDate, endDate]` para invariante
 * I12 (date∈período).
 */
export interface DispatchFiscalPeriod {
  id: string;
  name: string;
  status: string;
  startDate: Date;
  endDate: Date;
}

export interface DispatchFiscalPeriodsPort {
  getById(
    organizationId: string,
    periodId: string,
  ): Promise<DispatchFiscalPeriod>;

  /**
   * Resolves the fiscal period that contains the given date.
   * Returns null when no period covers that date (mobile offline: missing period).
   * Used by create/createAndPost when the caller omits periodId.
   */
  findByDate(
    organizationId: string,
    date: Date,
  ): Promise<DispatchFiscalPeriod | null>;
}
