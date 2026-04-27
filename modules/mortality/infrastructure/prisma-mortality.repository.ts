import "server-only";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma/client";
import type { MortalityRepository } from "../domain/mortality.repository";
import { Mortality } from "../domain/mortality.entity";
import { toDomain, toPersistence } from "./mortality.mapper";

const mortalityInclude = {
  lot: { select: { name: true, barnNumber: true } },
  createdBy: { select: { name: true, email: true } },
} as const;

export class PrismaMortalityRepository implements MortalityRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async findByLot(organizationId: string, lotId: string): Promise<Mortality[]> {
    const rows = await this.db.mortalityLog.findMany({
      where: { lotId, organizationId },
      include: mortalityInclude,
      orderBy: { date: "desc" },
    });
    return rows.map(toDomain);
  }

  async countByLot(organizationId: string, lotId: string): Promise<number> {
    const result = await this.db.mortalityLog.aggregate({
      where: { lotId, organizationId },
      _sum: { count: true },
    });
    return result._sum.count ?? 0;
  }

  async save(mortality: Mortality): Promise<void> {
    await this.db.mortalityLog.create({
      data: toPersistence(mortality),
    });
  }
}
