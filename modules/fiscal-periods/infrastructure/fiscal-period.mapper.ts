import type { FiscalPeriod as PrismaFiscalPeriod } from "@/generated/prisma/client";
import { FiscalPeriod } from "../domain/fiscal-period.entity";
import { FiscalPeriodStatus } from "../domain/value-objects/fiscal-period-status";
import { MonthlyRange } from "../domain/value-objects/monthly-range";

export function toDomain(row: PrismaFiscalPeriod): FiscalPeriod {
  return FiscalPeriod.fromPersistence({
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    range: MonthlyRange.of(row.startDate, row.endDate),
    status: FiscalPeriodStatus.of(row.status),
    closedAt: row.closedAt,
    closedBy: row.closedBy,
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function toPersistence(period: FiscalPeriod) {
  return {
    id: period.id,
    organizationId: period.organizationId,
    name: period.name,
    year: period.year,
    month: period.month,
    startDate: period.startDate,
    endDate: period.endDate,
    status: period.status.value,
    closedAt: period.closedAt,
    closedBy: period.closedBy,
    createdById: period.createdById,
    createdAt: period.createdAt,
    updatedAt: period.updatedAt,
  };
}
