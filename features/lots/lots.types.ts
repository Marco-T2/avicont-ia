import type {
  ChickenLot,
  Expense,
  MortalityLog,
} from "@/generated/prisma/client";

// ── Domain types ──

export interface CreateLotInput {
  name: string;
  barnNumber: number;
  initialCount: number;
  startDate: Date;
  farmId: string;
}

export interface CloseLotInput {
  endDate: Date;
}

export type LotWithRelations = ChickenLot & {
  expenses: Expense[];
  mortalityLogs: MortalityLog[];
};

export interface LotSummary {
  lot: LotWithRelations;
  totalExpenses: number;
  totalMortality: number;
  aliveCount: number;
  costPerChicken: number;
}
