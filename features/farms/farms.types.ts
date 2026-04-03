import type { Farm, ChickenLot } from "@/generated/prisma/client";

// ── Domain types ──

export interface CreateFarmInput {
  name: string;
  location?: string;
  memberId: string;
}

export interface UpdateFarmInput {
  name?: string;
  location?: string;
}

export type FarmWithLots = Farm & {
  lots: ChickenLot[];
};
