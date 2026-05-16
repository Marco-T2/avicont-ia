import "server-only";
import { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";
import type {
  FiscalPeriodsReadPort,
  PaymentFiscalPeriod,
} from "../../domain/ports/fiscal-periods-read.port";

/**
 * Adapter wrapping `makeFiscalPeriodsService()` hex factory (returns
 * FiscalPeriod entity). Narrow via `entity.toSnapshot()` bridge to Prisma row
 * shape. Throws NotFoundError on missing period via the underlying service —
 * preserved for legacy parity.
 */
export class LegacyFiscalPeriodsAdapter implements FiscalPeriodsReadPort {
  constructor(
    private readonly service: ReturnType<
      typeof makeFiscalPeriodsService
    > = makeFiscalPeriodsService(),
  ) {}

  async getById(
    organizationId: string,
    id: string,
  ): Promise<PaymentFiscalPeriod> {
    const entity = await this.service.getById(organizationId, id);
    const period = entity.toSnapshot();
    return {
      id: period.id,
      status: period.status as "OPEN" | "CLOSED",
      name: period.name,
      startDate: period.startDate,
      endDate: period.endDate,
    };
  }
}
