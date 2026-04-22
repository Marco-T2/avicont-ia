import "server-only";
import {
  NotFoundError,
  ConflictError,
  INVALID_DATE_RANGE,
  FISCAL_PERIOD_MONTH_EXISTS,
  PERIOD_NOT_FOUND,
  ValidationError,
} from "@/features/shared/errors";
import { isPrismaUniqueViolation } from "@/features/shared/prisma-errors";
import { FiscalPeriodsRepository } from "./fiscal-periods.repository";
import type { CreateFiscalPeriodInput, FiscalPeriod } from "./fiscal-periods.types";

// REQ-3 — Spanish (es-BO) month names for user-facing conflict messages.
// Indexed 0-11 (January=0) to align with Date.getUTCMonth(); the service
// subtracts 1 from the 1-indexed `month` derived from `startDate` when
// indexing into this array.
const MONTH_NAMES_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

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

    // REQ-1 / REQ-3 — month-scoped uniqueness pre-check. `month` is derived
    // from `startDate` in UTC to stay consistent with `repo.create`, which
    // persists `startDate.getUTCMonth() + 1` to the `month` column.
    const month = input.startDate.getUTCMonth() + 1;

    const duplicate = await this.repo.findByYearAndMonth(
      organizationId,
      input.year,
      month,
    );
    if (duplicate) {
      throw new ConflictError(
        `Ya existe un período fiscal para ${MONTH_NAMES_ES[month - 1]} de ${input.year}`,
        FISCAL_PERIOD_MONTH_EXISTS,
      );
    }

    // REQ-3 Scenario 3.2 — P2002 trip-wire. A concurrent caller may win the
    // race against the pre-check and land a row for the same (year, month).
    // The composite unique index "fiscal_periods_organizationId_year_month_key"
    // rejects the duplicate with P2002. We MUST map it to
    // FISCAL_PERIOD_MONTH_EXISTS so callers never see a raw
    // PrismaClientKnownRequestError.
    //
    // TRIP-WIRE: the literal index string below MUST match the test
    // assertion verbatim. Any Prisma rename will fail both visibly.
    try {
      return await this.repo.create(organizationId, input);
    } catch (err) {
      if (
        isPrismaUniqueViolation(
          err,
          "fiscal_periods_organizationId_year_month_key",
        )
      ) {
        throw new ConflictError(
          `Ya existe un período fiscal para ${MONTH_NAMES_ES[month - 1]} de ${input.year}`,
          FISCAL_PERIOD_MONTH_EXISTS,
        );
      }
      throw err;
    }
  }

}
