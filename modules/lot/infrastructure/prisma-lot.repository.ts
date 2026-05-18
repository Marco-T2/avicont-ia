import "server-only";
import { prisma } from "@/lib/prisma";
import { type PrismaClient } from "@/generated/prisma/client";
import type {
  LotChildCounts,
  LotRepository,
  LotWithRelationsSnapshot,
} from "../domain/lot.repository";
import { Lot } from "../domain/lot.entity";
import { LotForFarmAtDateExists } from "../domain/errors/lot-errors";
import {
  toDomain,
  toPersistence,
  toLotWithRelationsSnapshot,
} from "./lot.mapper";

/**
 * Maps Prisma's P2002 uniqueness violation on the
 * `chicken_lots_organizationId_farmName_startDate_key` index into our
 * typed domain error. Any other P2002 (or non-P2002) error is
 * re-thrown unchanged so unrelated failures keep their original shape.
 */
const UNIQUE_INDEX = "chicken_lots_organizationId_farmName_startDate_key";

function isLotUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: unknown; meta?: { target?: unknown } };
  if (e.code !== "P2002") return false;
  const target = e.meta?.target;
  if (typeof target === "string") return target === UNIQUE_INDEX;
  if (Array.isArray(target)) {
    // Newer Prisma reports field names instead of the index name; accept
    // either form so we don't silently miss the mapping when Prisma's
    // shape changes underneath us.
    const fields = target.map((t) => String(t));
    return (
      target.includes(UNIQUE_INDEX) ||
      (fields.includes("organizationId") &&
        fields.includes("farmName") &&
        fields.includes("startDate"))
    );
  }
  return false;
}

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
    try {
      await this.db.chickenLot.create({ data: toPersistence(entity) });
    } catch (err) {
      if (isLotUniqueViolation(err)) {
        throw new LotForFarmAtDateExists(entity.farmName, entity.startDate);
      }
      throw err;
    }
  }

  async update(entity: Lot): Promise<void> {
    // Post simplify-lot-identifier: only farmName + status/endDate are
    // mutable. startDate stays out of the update payload — it is the
    // backbone of displayName + the (orgId, farmName, startDate) unique
    // index, so mutating it would silently rename the lot and reshuffle
    // identity (Marco-locked invariant).
    const data = toPersistence(entity);
    try {
      await this.db.chickenLot.update({
        where: { id: entity.id, organizationId: entity.organizationId },
        data: {
          initialCount: data.initialCount,
          endDate: data.endDate,
          status: data.status,
          farmName: data.farmName,
        },
      });
    } catch (err) {
      if (isLotUniqueViolation(err)) {
        throw new LotForFarmAtDateExists(entity.farmName, entity.startDate);
      }
      throw err;
    }
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
