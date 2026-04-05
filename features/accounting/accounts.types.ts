import type { Account, AccountType, AccountNature } from "@/generated/prisma/client";

// ── Input types ──

export interface CreateAccountInput {
  code?: string;
  name: string;
  type?: AccountType;
  /** Optional hint from the caller. If provided and conflicts with the derived nature, creation is rejected. */
  nature?: AccountNature;
  parentId?: string;
  isDetail?: boolean;
  requiresContact?: boolean;
  description?: string;
}

/** Fully resolved data after service-level validation. Repository receives this — no ambiguity. */
export interface ResolvedCreateAccountData {
  code: string;
  name: string;
  type: AccountType;
  nature: AccountNature;
  parentId: string | null;
  level: number;
  isDetail: boolean;
  requiresContact: boolean;
  description: string | null;
}

export interface UpdateAccountInput {
  name?: string;
  isActive?: boolean;
  isDetail?: boolean;
  requiresContact?: boolean;
  description?: string;
}

// ── Composite types ──

export type AccountWithChildren = Account & {
  children: Account[];
};
