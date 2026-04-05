import type { Account, AccountType, AccountNature } from "@/generated/prisma/client";

// ── Input types ──

export interface CreateAccountInput {
  code: string;
  name: string;
  type: AccountType;
  /** Optional hint from the caller. If provided and conflicts with the derived nature, creation is rejected. */
  nature?: AccountNature;
  parentId?: string;
  level: number;
  isDetail?: boolean;
  requiresContact?: boolean;
  description?: string;
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
