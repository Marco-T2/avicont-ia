import { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";
import type {
  FiscalPeriodReaderPort,
  MonthlyCloseFiscalPeriod,
} from "../domain/ports/fiscal-period-reader.port";

/**
 * Cross-module narrow map (13→2 fields) sobre `makeFiscalPeriodsService().getById`
 * via `entity.toSnapshot()` bridge (FiscalPeriod entity → FiscalPeriodSnapshot
 * Prisma row shape). Throw legacy `NotFoundError(PERIOD_NOT_FOUND)` se propaga
 * sin re-wrap (adapter NO captura).
 *
 * Factory-wrap NO-direct-Prisma → NO §17 cite (R3 vigente — wraps hex factory
 * `fiscal-periods/presentation/server`, NO cross-module Prisma concrete imports).
 *
 * Naming convention NO-prisma-prefix Lock #2 opción (b) mirror accounting
 * `fiscal-periods-read.adapter.ts` precedent variant — 3ra evidencia matures
 * cumulative cross-module factory-wrap convention canonical (iva-books
 * `legacy-fiscal-periods.adapter.ts` 1ra + accounting `fiscal-periods-read.adapter.ts`
 * 2da + monthly-close `fiscal-period-reader.adapter.ts` 3ra). Constructor
 * default-init mirror iva-books precedent shape EXACT (testable per-instance).
 */
export class FiscalPeriodReaderAdapter implements FiscalPeriodReaderPort {
  constructor(
    private readonly service: ReturnType<
      typeof makeFiscalPeriodsService
    > = makeFiscalPeriodsService(),
  ) {}

  async getById(
    organizationId: string,
    periodId: string,
  ): Promise<MonthlyCloseFiscalPeriod> {
    const entity = await this.service.getById(organizationId, periodId);
    const period = entity.toSnapshot();
    return {
      id: period.id,
      status: period.status as "OPEN" | "CLOSED",
    };
  }
}
