import "server-only";
import { BaseRepository } from "@/features/shared/base.repository";
import type {
  LogMortalityInput,
  MortalityFilters,
  MortalityLogWithRelations,
} from "./mortality.types";

const mortalityInclude = {
  lot: { select: { name: true, barnNumber: true } },
  createdBy: { select: { name: true, email: true } },
} as const;

export class MortalityRepository extends BaseRepository {
  async findAll(
    organizationId: string,
    filters?: MortalityFilters,
  ): Promise<MortalityLogWithRelations[]> {
    const scope = this.requireOrg(organizationId);

    return this.db.mortalityLog.findMany({
      where: {
        ...scope,
        ...(filters?.lotId && { lotId: filters.lotId }),
        ...(filters?.dateFrom || filters?.dateTo
          ? {
              date: {
                ...(filters.dateFrom && { gte: filters.dateFrom }),
                ...(filters.dateTo && { lte: filters.dateTo }),
              },
            }
          : {}),
      },
      include: mortalityInclude,
      orderBy: { date: "desc" },
    }) as Promise<MortalityLogWithRelations[]>;
  }

  async findByLot(
    organizationId: string,
    lotId: string,
  ): Promise<MortalityLogWithRelations[]> {
    const scope = this.requireOrg(organizationId);

    return this.db.mortalityLog.findMany({
      where: { lotId, ...scope },
      include: mortalityInclude,
      orderBy: { date: "desc" },
    }) as Promise<MortalityLogWithRelations[]>;
  }

  async create(
    organizationId: string,
    data: LogMortalityInput,
  ): Promise<MortalityLogWithRelations> {
    const scope = this.requireOrg(organizationId);

    return this.db.mortalityLog.create({
      data: {
        count: data.count,
        cause: data.cause ?? null,
        date: data.date,
        lotId: data.lotId,
        createdById: data.createdById,
        organizationId: scope.organizationId,
      },
      include: mortalityInclude,
    }) as Promise<MortalityLogWithRelations>;
  }

  async countByLot(organizationId: string, lotId: string): Promise<number> {
    const scope = this.requireOrg(organizationId);

    const result = await this.db.mortalityLog.aggregate({
      where: { lotId, ...scope },
      _sum: { count: true },
    });

    return result._sum.count ?? 0;
  }
}
