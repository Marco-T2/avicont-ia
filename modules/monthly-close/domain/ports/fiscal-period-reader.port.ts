/**
 * Read-only port for fiscal periods consumed by monthly-close orchestrator
 * use case. Non-tx — el periodo se lee antes de que la UoW tx abra (paridad
 * con `iva-books/.../fiscal-period-reader.port.ts` +
 * `payment/.../fiscal-periods-read.port.ts` +
 * `accounting/.../fiscal-periods-read.port.ts`).
 *
 * El adapter (C3) MUST throw NotFoundError(PERIOD_NOT_FOUND) cuando el periodo
 * no existe — legacy parity `features/monthly-close/monthly-close.service.ts:142`
 * (`periodsService.getById` throw on miss).
 *
 * **Cross-module §13 fiscal-periods-C 8va evidencia D1 cementación cumulative**:
 * port own outbound, infra adapter C3 wraps `makeFiscalPeriodsService` factory
 * call cumulative absorb desde fiscal-periods D1 cementación 7ma evidencia.
 *
 * **Snapshot LOCAL §13 #1655 8va evidencia D1 cementación cumulative**:
 * `MonthlyCloseFiscalPeriod` primitive-typed mirror `IvaFiscalPeriod` precedent
 * EXACT (id + status enum). Consumer-side check `status === "OPEN"` (NO `isOpen`
 * port method, `validateCanClose` es monthly-close.service internal — recon-driven
 * correction archive `design.md` flow steps interpretation).
 *
 * **Naming axis cumulative cross-module 4 evidencias** `*ReaderPort` suffix
 * (mirror iva-books/sale/payment/accounting precedent EXACT) — Marco lock C1
 * lock #1 supersede pre-bookmark `FiscalPeriodReader` sin Port via
 * `Marco-lock-superseded-by-cumulative-precedent` 1ra evidencia.
 */
export interface MonthlyCloseFiscalPeriod {
  id: string;
  status: "OPEN" | "CLOSED";
}

export interface FiscalPeriodReaderPort {
  getById(
    organizationId: string,
    periodId: string,
  ): Promise<MonthlyCloseFiscalPeriod>;
}
