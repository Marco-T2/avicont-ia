import type { MortalityLog } from "@/generated/prisma/client";
import { formatDateBO } from "@/lib/date-utils";
import { Mortality } from "../domain/mortality.entity";
import { MortalityCount } from "../domain/value-objects/mortality-count";

/**
 * Post simplify-lot-identifier the lot relation no longer carries the
 * dropped `name` + `barnNumber` columns. The mortality include selects
 * `farmName + startDate` and this mapper derives `displayName` inline —
 * same shape Lot.entity#displayName exposes (kept in lockstep manually
 * because crossing module boundaries with a shared formatter beats
 * leaking the Lot entity into mortality's hex).
 */
type MortalityRow = MortalityLog & {
  lot?: { farmName: string; startDate: Date };
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
        ? {
            lot: {
              displayName: `${row.lot.farmName} - ${formatDateBO(row.lot.startDate)}`,
            },
            createdBy: row.createdBy,
          }
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
