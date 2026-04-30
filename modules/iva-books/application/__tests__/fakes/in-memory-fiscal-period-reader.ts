import type {
  FiscalPeriodReaderPort,
  IvaFiscalPeriod,
} from "../../../domain/ports/fiscal-period-reader.port";

/**
 * In-memory fake of `FiscalPeriodReaderPort` for IVA-hex application tests.
 * Mirror sale-hex `InMemoryFiscalPeriodsRead`. Throws if period not preloaded
 * (legacy parity: adapter throws NotFoundError when period missing).
 */
export class InMemoryFiscalPeriodReader implements FiscalPeriodReaderPort {
  private readonly store = new Map<string, IvaFiscalPeriod>();
  calls: { organizationId: string; periodId: string }[] = [];

  preload(periodId: string, status: "OPEN" | "CLOSED"): void {
    this.store.set(periodId, { id: periodId, status });
  }

  async getById(
    organizationId: string,
    periodId: string,
  ): Promise<IvaFiscalPeriod> {
    this.calls.push({ organizationId, periodId });
    const period = this.store.get(periodId);
    if (!period) {
      throw new Error(
        `InMemoryFiscalPeriodReader: period ${periodId} not preloaded`,
      );
    }
    return period;
  }
}
