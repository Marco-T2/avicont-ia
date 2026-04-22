import "server-only";
import { BaseRepository } from "@/features/shared/base.repository";
import type { FiscalPeriodStatus } from "@/generated/prisma/client";
import type { CreateFiscalPeriodInput, FiscalPeriod } from "./fiscal-periods.types";

export class FiscalPeriodsRepository extends BaseRepository {
  async findAll(organizationId: string): Promise<FiscalPeriod[]> {
    const scope = this.requireOrg(organizationId);

    return this.db.fiscalPeriod.findMany({
      where: scope,
      orderBy: { year: "desc" },
    });
  }

  async findById(organizationId: string, id: string): Promise<FiscalPeriod | null> {
    const scope = this.requireOrg(organizationId);

    return this.db.fiscalPeriod.findFirst({
      where: { id, ...scope },
    });
  }

  async findByYear(organizationId: string, year: number): Promise<FiscalPeriod | null> {
    const scope = this.requireOrg(organizationId);

    return this.db.fiscalPeriod.findFirst({
      where: { year, ...scope },
    });
  }

  async findOpenPeriod(organizationId: string): Promise<FiscalPeriod | null> {
    const scope = this.requireOrg(organizationId);

    return this.db.fiscalPeriod.findFirst({
      where: { status: "OPEN", ...scope },
    });
  }

  async create(
    organizationId: string,
    data: CreateFiscalPeriodInput,
  ): Promise<FiscalPeriod> {
    const scope = this.requireOrg(organizationId);

    return this.db.fiscalPeriod.create({
      data: {
        name: data.name,
        year: data.year,
        // Derive calendar month from startDate — FiscalPeriod schema mandates
        // month ∈ [1,12] and @@unique([organizationId, year, month]) since
        // Phase 1 of cierre-periodo. getUTCMonth() returns 0-indexed.
        month: data.startDate.getUTCMonth() + 1,
        startDate: data.startDate,
        endDate: data.endDate,
        status: "OPEN",
        createdById: data.createdById,
        organizationId: scope.organizationId,
      },
    });
  }

  async updateStatus(
    organizationId: string,
    id: string,
    status: FiscalPeriodStatus,
  ): Promise<FiscalPeriod> {
    const scope = this.requireOrg(organizationId);

    return this.db.fiscalPeriod.update({
      where: { id, ...scope },
      data: { status },
    });
  }

  async countDraftEntries(organizationId: string, periodId: string): Promise<number> {
    const scope = this.requireOrg(organizationId);

    return this.db.journalEntry.count({
      where: {
        periodId,
        status: "DRAFT",
        ...scope,
      },
    });
  }
}
