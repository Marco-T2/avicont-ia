import "server-only";
import { prisma } from "@/lib/prisma";
import { type PrismaClient } from "@/generated/prisma/client";
import type {
  FarmRepository,
  FarmFilters,
} from "../domain/farm.repository";
import { Farm } from "../domain/farm.entity";
import { toDomain, toPersistence } from "./farm.mapper";

type DbClient = Pick<PrismaClient, "farm">;

export class PrismaFarmRepository implements FarmRepository {
  constructor(private readonly db: DbClient = prisma) {}

  async findAll(
    organizationId: string,
    filters?: FarmFilters,
  ): Promise<Farm[]> {
    const rows = await this.db.farm.findMany({
      where: {
        organizationId,
        ...(filters?.memberId ? { memberId: filters.memberId } : {}),
      },
      orderBy: { name: "asc" },
    });
    return rows.map(toDomain);
  }

  async findById(organizationId: string, id: string): Promise<Farm | null> {
    const row = await this.db.farm.findFirst({
      where: { id, organizationId },
    });
    return row ? toDomain(row) : null;
  }

  async findByName(organizationId: string, name: string): Promise<Farm | null> {
    const row = await this.db.farm.findFirst({
      where: { organizationId, name },
    });
    return row ? toDomain(row) : null;
  }

  async save(entity: Farm): Promise<void> {
    await this.db.farm.create({ data: toPersistence(entity) });
  }

  async update(entity: Farm): Promise<void> {
    await this.db.farm.update({
      where: { id: entity.id, organizationId: entity.organizationId },
      data: {
        name: entity.name,
        location: entity.location,
      },
    });
  }

  async delete(organizationId: string, id: string): Promise<void> {
    await this.db.farm.delete({
      where: { id, organizationId },
    });
  }
}
