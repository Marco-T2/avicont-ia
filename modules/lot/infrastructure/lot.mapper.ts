import type {
  ChickenLot,
  Expense,
  MortalityLog,
} from "@/generated/prisma/client";
import { Lot } from "../domain/lot.entity";
import {
  parseLotStatus,
  type LotStatus,
} from "../domain/value-objects/lot-status";
import type { LotWithRelationsSnapshot } from "../domain/lot.repository";

type ChickenLotWithRelationsRow = ChickenLot & {
  expenses: Pick<Expense, "amount">[];
  mortalityLogs: Pick<MortalityLog, "count">[];
};

/**
 * D-1 bridge translation: Prisma `LotStatus` enum still holds the
 * legacy 3-state `ACTIVE | CLOSED | SOLD` until the F5-final
 * destructive migration drops CLOSED + SOLD. The domain VO is
 * already narrowed to binary `ACTIVE | INACTIVE` (REQ-202), so the
 * mapper translates at the boundary:
 *   - read:  CLOSED | SOLD → INACTIVE   (lossy; both collapse)
 *   - write: INACTIVE      → CLOSED     (chosen by convention)
 * The domain VO never sees CLOSED|SOLD; the DB never sees INACTIVE.
 */
function dbToDomainStatus(raw: ChickenLot["status"]): LotStatus {
  if (raw === "ACTIVE") return "ACTIVE";
  // CLOSED + SOLD both collapse to INACTIVE per REQ-202 (binary lifecycle)
  return "INACTIVE";
}

function domainToDbStatus(s: LotStatus): ChickenLot["status"] {
  if (s === "ACTIVE") return "ACTIVE";
  // INACTIVE → CLOSED until F5 drops the legacy SOLD enum value
  return "CLOSED";
}

export function toDomain(row: ChickenLot): Lot {
  return Lot.fromPersistence({
    id: row.id,
    name: row.name,
    barnNumber: row.barnNumber,
    initialCount: row.initialCount,
    startDate: row.startDate,
    endDate: row.endDate,
    status: parseLotStatus(dbToDomainStatus(row.status)),
    farmId: row.farmId,
    organizationId: row.organizationId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function toPersistence(entity: Lot) {
  const s = entity.toSnapshot();
  return {
    id: s.id,
    name: s.name,
    barnNumber: s.barnNumber,
    initialCount: s.initialCount,
    startDate: s.startDate,
    endDate: s.endDate,
    status: domainToDbStatus(s.status),
    farmId: s.farmId,
    organizationId: s.organizationId,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

export function toLotWithRelationsSnapshot(
  row: ChickenLotWithRelationsRow,
): LotWithRelationsSnapshot {
  return {
    lot: toDomain(row),
    expenses: row.expenses.map((e) => ({ amount: Number(e.amount) })),
    mortalityLogs: row.mortalityLogs.map((m) => ({ count: m.count })),
  };
}
