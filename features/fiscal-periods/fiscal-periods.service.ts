import "server-only";
import {
  NotFoundError,
  ConflictError,
  INVALID_DATE_RANGE,
  FISCAL_PERIOD_YEAR_EXISTS,
  ACTIVE_PERIOD_ALREADY_EXISTS,
  PERIOD_NOT_FOUND,
  ValidationError,
} from "@/features/shared/errors";
import { FiscalPeriodsRepository } from "./fiscal-periods.repository";
import type { CreateFiscalPeriodInput, FiscalPeriod } from "./fiscal-periods.types";

export class FiscalPeriodsService {
  private readonly repo: FiscalPeriodsRepository;

  constructor(repo?: FiscalPeriodsRepository) {
    this.repo = repo ?? new FiscalPeriodsRepository();
  }

  // ── List all fiscal periods ──

  async list(organizationId: string): Promise<FiscalPeriod[]> {
    return this.repo.findAll(organizationId);
  }

  // ── Get a single fiscal period ──

  async getById(organizationId: string, id: string): Promise<FiscalPeriod> {
    const period = await this.repo.findById(organizationId, id);
    if (!period) throw new NotFoundError("Período fiscal", PERIOD_NOT_FOUND);
    return period;
  }

  // ── Create a new fiscal period ──

  async create(
    organizationId: string,
    input: CreateFiscalPeriodInput,
  ): Promise<FiscalPeriod> {
    if (input.endDate <= input.startDate) {
      throw new ValidationError(
        "La fecha de cierre debe ser posterior a la fecha de apertura",
        INVALID_DATE_RANGE,
      );
    }

    const existing = await this.repo.findByYear(organizationId, input.year);
    if (existing) {
      throw new ConflictError(
        `Un período fiscal para el año ${input.year}`,
        FISCAL_PERIOD_YEAR_EXISTS,
      );
    }

    const openPeriod = await this.repo.findOpenPeriod(organizationId);
    if (openPeriod) {
      throw new ConflictError(
        `Un período fiscal abierto (${openPeriod.name})`,
        ACTIVE_PERIOD_ALREADY_EXISTS,
      );
    }

    return this.repo.create(organizationId, input);
  }

}
