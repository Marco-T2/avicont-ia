import type {
  ChickenLot,
  Expense,
  MortalityLog,
} from "@/generated/prisma/client";
import { Lot } from "../domain/lot.entity";
import { parseLotStatus } from "../domain/value-objects/lot-status";
import type { LotWithRelationsSnapshot } from "../domain/lot.repository";

type ChickenLotWithRelationsRow = ChickenLot & {
  expenses: Pick<Expense, "amount">[];
  mortalityLogs: Pick<MortalityLog, "count">[];
};

/**
 * Post retire-farm-collapse-to-lot F5-final: el enum Prisma `LotStatus`
 * está alineado 1:1 con el VO domain (ACTIVE | INACTIVE). La traducción
 * intermedia y el sentinel `_legacyFarmId` fueron retirados — el mapper
 * es ahora un pass-through directo.
 */
export function toDomain(row: ChickenLot): Lot {
  return Lot.fromPersistence({
    id: row.id,
    name: row.name,
    barnNumber: row.barnNumber,
    initialCount: row.initialCount,
    startDate: row.startDate,
    endDate: row.endDate,
    status: parseLotStatus(row.status),
    farmName: row.farmName,
    memberId: row.memberId,
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
    status: s.status,
    farmName: s.farmName,
    memberId: s.memberId,
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
