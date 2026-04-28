import "server-only";
import { FiscalPeriodsService } from "@/features/fiscal-periods/server";
import type {
  FiscalPeriodsReadPort,
  PaymentFiscalPeriod,
} from "../../domain/ports/fiscal-periods-read.port";

/**
 * Adapter wrapping the legacy `FiscalPeriodsService` (which shims to
 * `modules/fiscal-periods/`). Throws NotFoundError on missing period via
 * the underlying service — preserved for legacy parity.
 */
export class LegacyFiscalPeriodsAdapter implements FiscalPeriodsReadPort {
  constructor(
    private readonly service: FiscalPeriodsService = new FiscalPeriodsService(),
  ) {}

  async getById(
    organizationId: string,
    id: string,
  ): Promise<PaymentFiscalPeriod> {
    const period = await this.service.getById(organizationId, id);
    return {
      id: period.id,
      status: period.status as "OPEN" | "CLOSED",
    };
  }
}
