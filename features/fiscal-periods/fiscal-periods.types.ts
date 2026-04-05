import type { FiscalPeriod, FiscalPeriodStatus } from "@/generated/prisma/client";

// ── Input types ──

export interface CreateFiscalPeriodInput {
  name: string;
  year: number;
  startDate: Date;
  endDate: Date;
  createdById: string;
}

// ── Re-export Prisma types for convenience ──

export type { FiscalPeriod, FiscalPeriodStatus };
