import type { ProductType } from "@/generated/prisma/client";

// ── Re-export Prisma type for convenience ──

export type { ProductType };

// ── Input types ──

export interface CreateProductTypeInput {
  name: string; // max 100
  code: string; // max 20
  sortOrder?: number;
}

export interface UpdateProductTypeInput {
  name?: string;
  code?: string;
  isActive?: boolean;
  sortOrder?: number;
}

// ── Filter types ──

export interface ProductTypeFilters {
  isActive?: boolean;
}
