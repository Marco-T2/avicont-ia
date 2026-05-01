import "server-only";
import { FiscalPeriodsService } from "@/features/fiscal-periods/server";
import type {
  FiscalPeriodReaderPort,
  IvaFiscalPeriod,
} from "../domain/ports/fiscal-period-reader.port";

/**
 * Wrap legacy `FiscalPeriodsService` (que shimea a `modules/fiscal-periods`).
 * Narrow 13→2 (`{ id, status }`) + throw `NotFoundError(PERIOD_NOT_FOUND)`
 * pass-through legacy parity — el adapter no captura, el throw se propaga
 * bit-exact.
 *
 * 3rd own-port duplicate (accounting + payment + iva-books). Promote a
 * `modules/shared/domain/ports/` scheduled POC #11.0c A5 reorg E-2 — refactor
 * cross-module ~20 archivos diferido por scope reduction §18.
 */
export class LegacyFiscalPeriodsAdapter implements FiscalPeriodReaderPort {
  constructor(
    private readonly service: FiscalPeriodsService = new FiscalPeriodsService(),
  ) {}

  async getById(
    organizationId: string,
    periodId: string,
  ): Promise<IvaFiscalPeriod> {
    const period = await this.service.getById(organizationId, periodId);
    return {
      id: period.id,
      status: period.status as "OPEN" | "CLOSED",
    };
  }
}
