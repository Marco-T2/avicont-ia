import type {
  OperationalDocType,
  OperationalDocDirection,
} from "@/generated/prisma/client";

// ── Re-export Prisma types for convenience ──

export type { OperationalDocType, OperationalDocDirection };

// ── Input types ──

export interface CreateOperationalDocTypeInput {
  code: string; // max 20
  name: string; // max 100
  direction: OperationalDocDirection;
}

export interface UpdateOperationalDocTypeInput {
  name?: string;
  direction?: OperationalDocDirection;
  isActive?: boolean;
}

// ── Filter types ──

export interface OperationalDocTypeFilters {
  isActive?: boolean;
  direction?: OperationalDocDirection;
}
