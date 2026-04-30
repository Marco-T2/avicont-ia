import type {
  AccountingFiscalPeriod,
  FiscalPeriodsReadPort,
} from "@/modules/accounting/domain/ports/fiscal-periods-read.port";

/**
 * In-memory `FiscalPeriodsReadPort` fake para purchase-hex application
 * tests. Espejo simétrico del fake sale-hex (paridad bit-exact).
 */
export class InMemoryFiscalPeriodsRead implements FiscalPeriodsReadPort {
  private readonly store = new Map<string, AccountingFiscalPeriod>();
  calls: { organizationId: string; periodId: string }[] = [];

  preload(periodId: string, status: "OPEN" | "CLOSED"): void {
    this.store.set(periodId, { id: periodId, status });
  }

  async getById(
    organizationId: string,
    periodId: string,
  ): Promise<AccountingFiscalPeriod> {
    this.calls.push({ organizationId, periodId });
    const period = this.store.get(periodId);
    if (!period) {
      throw new Error(
        `InMemoryFiscalPeriodsRead: period ${periodId} not preloaded`,
      );
    }
    return period;
  }
}
