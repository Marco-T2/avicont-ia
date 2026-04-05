import type { VoucherTypeCfg, VoucherTypeCode } from "@/generated/prisma/client";

// ── Input types ──

export interface CreateVoucherTypeInput {
  code: VoucherTypeCode;
  name: string;
  description?: string;
}

export interface UpdateVoucherTypeInput {
  name?: string;
  description?: string;
  isActive?: boolean;
}

// ── Re-export the Prisma model for convenience ──

export type { VoucherTypeCfg, VoucherTypeCode };
