import type { FiscalPeriod } from "./fiscal-period.entity";

export interface FiscalPeriodRepository {
  findAll(organizationId: string): Promise<FiscalPeriod[]>;
  findById(organizationId: string, id: string): Promise<FiscalPeriod | null>;
  findByYearAndMonth(
    organizationId: string,
    year: number,
    month: number,
  ): Promise<FiscalPeriod | null>;
  save(period: FiscalPeriod): Promise<void>;
}
