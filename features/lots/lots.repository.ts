import "server-only";
import { BaseRepository } from "@/features/shared/base.repository";
import type { ChickenLot } from "@/generated/prisma/client";
import type { CreateLotInput, LotWithRelations } from "./lots.types";

const lotWithRelationsInclude = {
  expenses: true,
  mortalityLogs: true,
} as const;

export class LotsRepository extends BaseRepository {
  async findAll(organizationId: string): Promise<ChickenLot[]> {
    const scope = this.requireOrg(organizationId);

    return this.db.chickenLot.findMany({
      where: scope,
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(
    organizationId: string,
    id: string,
  ): Promise<ChickenLot | null> {
    const scope = this.requireOrg(organizationId);

    return this.db.chickenLot.findFirst({
      where: { id, ...scope },
    });
  }

  async findByFarm(
    organizationId: string,
    farmId: string,
  ): Promise<ChickenLot[]> {
    const scope = this.requireOrg(organizationId);

    return this.db.chickenLot.findMany({
      where: { farmId, ...scope },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(
    organizationId: string,
    data: CreateLotInput,
  ): Promise<ChickenLot> {
    const scope = this.requireOrg(organizationId);

    return this.db.chickenLot.create({
      data: {
        name: data.name,
        barnNumber: data.barnNumber,
        initialCount: data.initialCount,
        startDate: data.startDate,
        farmId: data.farmId,
        organizationId: scope.organizationId,
      },
    });
  }

  async close(
    organizationId: string,
    id: string,
    endDate: Date,
  ): Promise<ChickenLot> {
    const scope = this.requireOrg(organizationId);

    return this.db.chickenLot.update({
      where: { id, ...scope },
      data: {
        status: "CLOSED",
        endDate,
      },
    });
  }

  async findByIdWithRelations(
    organizationId: string,
    id: string,
  ): Promise<LotWithRelations | null> {
    const scope = this.requireOrg(organizationId);

    return this.db.chickenLot.findFirst({
      where: { id, ...scope },
      include: lotWithRelationsInclude,
    }) as Promise<LotWithRelations | null>;
  }
}
