import type { VoucherTypeCfg } from "@/generated/prisma/client";

// ── Input types ──

export interface CreateVoucherTypeInput {
  code: string;
  prefix: string;
  name: string;
  description?: string;
}

export interface UpdateVoucherTypeInput {
  name?: string;
  prefix?: string;
  description?: string;
  isActive?: boolean;
}

export interface ListVoucherTypesOptions {
  isActive?: boolean;
  includeCounts?: boolean;
}

// ── Re-export the Prisma model for convenience ──

export type { VoucherTypeCfg };
