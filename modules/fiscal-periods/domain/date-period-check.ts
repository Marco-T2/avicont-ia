/**
 * Compara `date` contra `[period.startDate, period.endDate]` por calendar-day-slice
 * (YYYY-MM-DD). La convención §13.accounting.calendar-day-T12-utc-unified emite
 * fechas T12, los startDate/endDate del período son T00 — ambos comparten el
 * calendar day en UTC, así que `.toISOString().slice(0, 10)` es la comparación
 * unambigua.
 *
 * Helper compartido por journal/sale/purchase. Cada módulo provee SU propia
 * error class (`JournalDateOutsidePeriod`, `SaleDateOutsidePeriod`,
 * `PurchaseDateOutsidePeriod`) — esta función solo retorna boolean, el caller
 * decide qué tirar.
 */
export interface PeriodRange {
  startDate: Date;
  endDate: Date;
}

export function isDateWithinPeriod(date: Date, period: PeriodRange): boolean {
  const d = date.toISOString().slice(0, 10);
  const start = period.startDate.toISOString().slice(0, 10);
  const end = period.endDate.toISOString().slice(0, 10);
  return d >= start && d <= end;
}
