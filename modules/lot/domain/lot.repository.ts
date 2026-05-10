import type { Lot } from "./lot.entity";

export interface LotWithRelationsSnapshot {
  lot: Lot;
  expenses: { amount: number }[];
  mortalityLogs: { count: number }[];
}

export interface LotRepository {
  findAll(organizationId: string): Promise<Lot[]>;
  findById(organizationId: string, id: string): Promise<Lot | null>;
  findByFarm(organizationId: string, farmId: string): Promise<Lot[]>;
  findByIdWithRelations(
    organizationId: string,
    id: string,
  ): Promise<LotWithRelationsSnapshot | null>;
  save(lot: Lot): Promise<void>;
  update(lot: Lot): Promise<void>;
}
