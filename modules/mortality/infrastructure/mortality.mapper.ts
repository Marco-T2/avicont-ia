import type { MortalityLog } from "@/generated/prisma/client";
import { Mortality } from "../domain/mortality.entity";
import { MortalityCount } from "../domain/value-objects/mortality-count";

type MortalityRow = MortalityLog & {
  lot?: { name: string; barnNumber: number };
  createdBy?: { name: string | null; email: string };
};

export function toDomain(row: MortalityRow): Mortality {
  return Mortality.fromPersistence({
    id: row.id,
    count: MortalityCount.of(row.count),
    cause: row.cause,
    date: row.date,
    lotId: row.lotId,
    createdById: row.createdById,
    organizationId: row.organizationId,
    relations:
      row.lot && row.createdBy
        ? { lot: row.lot, createdBy: row.createdBy }
        : undefined,
  });
}

export function toPersistence(m: Mortality) {
  return {
    id: m.id,
    count: m.count.value,
    cause: m.cause,
    date: m.date,
    lotId: m.lotId,
    createdById: m.createdById,
    organizationId: m.organizationId,
  };
}
