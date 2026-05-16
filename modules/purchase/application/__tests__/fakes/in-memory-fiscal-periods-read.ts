import type {
  AccountingFiscalPeriod,
  FiscalPeriodsReadPort,
} from "@/modules/accounting/domain/ports/fiscal-periods-read.port";

/**
 * In-memory `FiscalPeriodsReadPort` fake para purchase-hex application
 * tests. Espejo simétrico del fake sale-hex (paridad bit-exact).
 *
 * Storage shape interno: `name`, `startDate`, `endDate` son opcionales al
 * primar (defaults sane los completa `getById`) — el invariante I12
 * (date∈período) corre en producción contra el adapter real que siempre
 * provee los 5 campos. Tests que validen I12 priman startDate/endDate
 * explícitos vía `preloadFull`.
 */
type StoredFiscalPeriod = {
  id: string;
  status: "OPEN" | "CLOSED";
  name?: string;
  startDate?: Date;
  endDate?: Date;
};

export class InMemoryFiscalPeriodsRead implements FiscalPeriodsReadPort {
  private readonly store = new Map<string, StoredFiscalPeriod>();
  calls: { organizationId: string; periodId: string }[] = [];

  preload(periodId: string, status: "OPEN" | "CLOSED"): void {
    this.store.set(periodId, { id: periodId, status });
  }

  /** Para tests que validan I12 — name/startDate/endDate explícitos. */
  preloadFull(period: StoredFiscalPeriod): void {
    this.store.set(period.id, period);
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
    return {
      id: period.id,
      status: period.status,
      name: period.name ?? `Período ${period.id}`,
      startDate: period.startDate ?? new Date("2000-01-01T00:00:00.000Z"),
      endDate: period.endDate ?? new Date("2099-12-31T23:59:59.999Z"),
    };
  }
}
