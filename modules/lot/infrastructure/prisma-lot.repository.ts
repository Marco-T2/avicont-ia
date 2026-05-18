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

/**
 * Includes the tables touched by `delete` cascade tx (expense +
 * mortalityLog) and `$transaction` itself. Kept as `Pick` to retain
 * the narrow-by-default ethos — adapter only ever reaches into these
 * three tables and the tx primitive.
 */
type DbClient = Pick<
  PrismaClient,
  "chickenLot" | "expense" | "mortalityLog" | "$transaction"
>;

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
    // Post retire-farm-collapse-to-lot F5-final: el mapper es 1:1, sin
    // bridge translation. memberId + organizationId siguen siendo
    // immutables (INV-04) — no se incluyen en el update payload.
    const data = toPersistence(entity);
    await this.db.chickenLot.update({
      where: { id: entity.id, organizationId: entity.organizationId },
      data: {
        name: data.name,
        barnNumber: data.barnNumber,
        initialCount: data.initialCount,
        startDate: data.startDate,
        endDate: data.endDate,
        status: data.status,
        farmName: data.farmName,
      },
    });
  }

  async findChildCounts(
    organizationId: string,
    id: string,
  ): Promise<LotChildCounts> {
    const [expenses, mortality] = await Promise.all([
      this.db.expense.count({
        where: { organizationId, lotId: id },
      }),
      this.db.mortalityLog.count({
        where: { organizationId, lotId: id },
      }),
    ]);
    return { expenses, mortality };
  }

  /**
   * Cascade hard-delete: removes all child Expense + MortalityLog
   * records first, then the Lot itself. Wrapped in a single Prisma
   * `$transaction([...])` array form so the operations succeed or
   * fail atomically (INV-06, spec REQ-101). Both `@@index([lotId])`
   * indexes exist on Expense (schema L252) and MortalityLog (L271)
   * → the `deleteMany` queries are index-backed.
   */
  async delete(organizationId: string, id: string): Promise<void> {
    await this.db.$transaction([
      this.db.expense.deleteMany({
        where: { organizationId, lotId: id },
      }),
      this.db.mortalityLog.deleteMany({
        where: { organizationId, lotId: id },
      }),
      this.db.chickenLot.delete({
        where: { id, organizationId },
      }),
    ]);
  }
}
