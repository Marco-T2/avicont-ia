import "server-only";
import { prisma } from "@/lib/prisma";
import { type PrismaClient } from "@/generated/prisma/client";
import type {
  LotRepository,
  LotWithRelationsSnapshot,
} from "../domain/lot.repository";
import { Lot } from "../domain/lot.entity";
import {
  toDomain,
  toPersistence,
  toLotWithRelationsSnapshot,
} from "./lot.mapper";

type DbClient = Pick<PrismaClient, "chickenLot">;

const lotWithRelationsInclude = {
  expenses: true,
  mortalityLogs: true,
} as const;

export class PrismaLotRepository implements LotRepository {
  constructor(private readonly db: DbClient = prisma) {}

  async findAll(organizationId: string): Promise<Lot[]> {
    const rows = await this.db.chickenLot.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDomain);
  }

  async findById(organizationId: string, id: string): Promise<Lot | null> {
    const row = await this.db.chickenLot.findFirst({
      where: { id, organizationId },
    });
    return row ? toDomain(row) : null;
  }

  async findByFarm(organizationId: string, farmId: string): Promise<Lot[]> {
    const rows = await this.db.chickenLot.findMany({
      where: { organizationId, farmId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDomain);
  }

  async findByIdWithRelations(
    organizationId: string,
    id: string,
  ): Promise<LotWithRelationsSnapshot | null> {
    const row = await this.db.chickenLot.findFirst({
      where: { id, organizationId },
      include: lotWithRelationsInclude,
    });
    return row ? toLotWithRelationsSnapshot(row) : null;
  }

  async save(entity: Lot): Promise<void> {
    await this.db.chickenLot.create({ data: toPersistence(entity) });
  }

  async update(entity: Lot): Promise<void> {
    await this.db.chickenLot.update({
      where: { id: entity.id, organizationId: entity.organizationId },
      data: {
        name: entity.name,
        barnNumber: entity.barnNumber,
        initialCount: entity.initialCount,
        startDate: entity.startDate,
        endDate: entity.endDate,
        status: entity.status,
        farmId: entity.farmId,
      },
    });
  }
}
