import { NotFoundError, PERIOD_NOT_FOUND } from "@/features/shared/errors";
import type { FiscalPeriodRepository } from "../domain/fiscal-period.repository";
import {
  FiscalPeriod,
  type CreateFiscalPeriodInput,
} from "../domain/fiscal-period.entity";
import { MonthAlreadyExists } from "../domain/errors/fiscal-period-errors";
import { monthNameEs } from "../domain/month-names";

export class FiscalPeriodsService {
  constructor(private readonly repo: FiscalPeriodRepository) {}

  async list(organizationId: string): Promise<FiscalPeriod[]> {
    return this.repo.findAll(organizationId);
  }

  async getById(organizationId: string, id: string): Promise<FiscalPeriod> {
    const period = await this.repo.findById(organizationId, id);
    if (!period) throw new NotFoundError("Período fiscal", PERIOD_NOT_FOUND);
    return period;
  }

  async findByDate(
    organizationId: string,
    date: Date,
  ): Promise<FiscalPeriod | null> {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    return this.repo.findByYearAndMonth(organizationId, year, month);
  }

  async create(
    organizationId: string,
    input: Omit<CreateFiscalPeriodInput, "organizationId">,
  ): Promise<FiscalPeriod> {
    // Build the entity FIRST — its factory enforces InvalidDateRange and
    // NotMonthly. Bailing out here keeps the duplicate-month DB lookup off
    // the path for malformed input.
    const period = FiscalPeriod.create({ ...input, organizationId });

    const duplicate = await this.repo.findByYearAndMonth(
      organizationId,
      period.year,
      period.month,
    );
    if (duplicate) {
      throw new MonthAlreadyExists(
        period.year,
        period.month,
        monthNameEs(period.month),
      );
    }

    await this.repo.save(period);
    return period;
  }
}
