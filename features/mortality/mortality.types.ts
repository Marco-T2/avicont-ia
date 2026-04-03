import type { MortalityLog } from "@/generated/prisma/client";

// ── Domain types ──

export interface LogMortalityInput {
  count: number;
  cause?: string;
  date: Date;
  lotId: string;
  createdById: string;
}

export interface MortalityFilters {
  lotId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export type MortalityLogWithRelations = MortalityLog & {
  lot: { name: string; barnNumber: number };
  createdBy: { name: string | null; email: string };
};
