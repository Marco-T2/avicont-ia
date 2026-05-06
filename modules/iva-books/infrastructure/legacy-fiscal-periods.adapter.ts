import "server-only";
import { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";
import type {
  FiscalPeriodReaderPort,
  IvaFiscalPeriod,
} from "../domain/ports/fiscal-period-reader.port";

/**
 * Wrap hex `makeFiscalPeriodsService()` factory (returns FiscalPeriod entity).
 * Narrow 13→2 (`{ id, status }`) via `entity.toSnapshot()` bridge + throw
 * `NotFoundError(PERIOD_NOT_FOUND)` pass-through legacy parity — el adapter no
 * captura, el throw se propaga bit-exact.
 *
 * 3rd own-port duplicate (accounting + payment + iva-books). Promote a
 * `modules/shared/domain/ports/` scheduled POC #11.0c A5 reorg E-2 — refactor
 * cross-module ~20 archivos diferido por scope reduction §18.
 */
export class LegacyFiscalPeriodsAdapter implements FiscalPeriodReaderPort {
  constructor(
    private readonly service: ReturnType<
      typeof makeFiscalPeriodsService
    > = makeFiscalPeriodsService(),
  ) {}

  async getById(
    organizationId: string,
    periodId: string,
  ): Promise<IvaFiscalPeriod> {
    const entity = await this.service.getById(organizationId, periodId);
    const period = entity.toSnapshot();
    return {
      id: period.id,
      status: period.status as "OPEN" | "CLOSED",
    };
  }
}
