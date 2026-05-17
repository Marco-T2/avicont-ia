import type { Lot } from "./lot.entity";

export interface LotWithRelationsSnapshot {
  lot: Lot;
  expenses: { amount: number }[];
  mortalityLogs: { count: number }[];
}

export interface LotChildCounts {
  expenses: number;
  mortality: number;
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
  /**
   * Returns counts of child records (Expense, MortalityLog) for the
   * given lot. Used by LotService.getDeletePreview to show the
   * granjero what will be cascade-deleted. Spec REQ-102.
   */
  findChildCounts(
    organizationId: string,
    id: string,
  ): Promise<LotChildCounts>;
  /**
   * Hard-deletes the lot AND all its child Expense + MortalityLog
   * records in a single Prisma transaction (INV-06). Spec REQ-101.
   */
  delete(organizationId: string, id: string): Promise<void>;
}
