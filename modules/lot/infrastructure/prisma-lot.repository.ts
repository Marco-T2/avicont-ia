import "server-only";
import { prisma } from "@/lib/prisma";
import { type PrismaClient } from "@/generated/prisma/client";
import type {
  LotChildCounts,
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

  /**
   * STUB — real impl lands in T29 GREEN (DbClient must expand to
   * include `expense | mortalityLog | $transaction`). Kept as
   * throw so tsc satisfies the LotRepository contract at T25, while
   * service-layer T26 RED + T27 GREEN can build against the port
   * via InMemory fake.
   */
  async findChildCounts(
    _organizationId: string,
    _id: string,
  ): Promise<LotChildCounts> {
    throw new Error(
      "PrismaLotRepository.findChildCounts not implemented yet (T29)",
    );
  }

  /** STUB — see findChildCounts JSDoc; real cascade tx lands in T29. */
  async delete(_organizationId: string, _id: string): Promise<void> {
    throw new Error(
      "PrismaLotRepository.delete not implemented yet (T29)",
    );
  }
}
