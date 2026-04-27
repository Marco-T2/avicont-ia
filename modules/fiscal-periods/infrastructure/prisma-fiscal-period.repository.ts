import "server-only";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma/client";
import { isPrismaUniqueViolation } from "@/features/shared/prisma-errors";
import type { FiscalPeriodRepository } from "../domain/fiscal-period.repository";
import { FiscalPeriod } from "../domain/fiscal-period.entity";
import { MonthAlreadyExists } from "../domain/errors/fiscal-period-errors";
import { monthNameEs } from "../domain/month-names";
import { toDomain, toPersistence } from "./fiscal-period.mapper";

// Index name from prisma migration. The legacy service kept this literal to
// trip-wire any rename — we keep the same trip-wire here at the adapter
// boundary so domain errors surface even when the DB races past the pre-check.
const UNIQUE_MONTH_INDEX = "fiscal_periods_organizationId_year_month_key";

export class PrismaFiscalPeriodRepository implements FiscalPeriodRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async findAll(organizationId: string): Promise<FiscalPeriod[]> {
    const rows = await this.db.fiscalPeriod.findMany({
      where: { organizationId },
      orderBy: { year: "desc" },
    });
    return rows.map(toDomain);
  }

  async findById(
    organizationId: string,
    id: string,
  ): Promise<FiscalPeriod | null> {
    const row = await this.db.fiscalPeriod.findFirst({
      where: { id, organizationId },
    });
    return row ? toDomain(row) : null;
  }

  async findByYearAndMonth(
    organizationId: string,
    year: number,
    month: number,
  ): Promise<FiscalPeriod | null> {
    const row = await this.db.fiscalPeriod.findFirst({
      where: { organizationId, year, month },
    });
    return row ? toDomain(row) : null;
  }

  async save(period: FiscalPeriod): Promise<void> {
    try {
      await this.db.fiscalPeriod.create({ data: toPersistence(period) });
    } catch (err) {
      if (isPrismaUniqueViolation(err, UNIQUE_MONTH_INDEX)) {
        throw new MonthAlreadyExists(
          period.year,
          period.month,
          monthNameEs(period.month),
        );
      }
      throw err;
    }
  }
}
