import "server-only";
import { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";
import type {
  DispatchFiscalPeriodsPort,
  DispatchFiscalPeriod,
} from "../domain/ports/dispatch-fiscal-periods.port";

/**
 * Legacy adapter: wraps FiscalPeriodsService for dispatch period validation.
 */
export class LegacyFiscalPeriodsAdapter implements DispatchFiscalPeriodsPort {
  private readonly service: ReturnType<typeof makeFiscalPeriodsService>;

  constructor() {
    this.service = makeFiscalPeriodsService();
  }

  async getById(
    organizationId: string,
    periodId: string,
  ): Promise<DispatchFiscalPeriod> {
    const period = await this.service.getById(organizationId, periodId);
    return {
      id: period.id,
      name: period.name,
      status: period.status.value,
      startDate: period.startDate,
      endDate: period.endDate,
    };
  }

  async findByDate(
    organizationId: string,
    date: Date,
  ): Promise<DispatchFiscalPeriod | null> {
    const period = await this.service.findByDate(organizationId, date);
    if (!period) return null;
    return {
      id: period.id,
      name: period.name,
      status: period.status.value,
      startDate: period.startDate,
      endDate: period.endDate,
    };
  }
}
