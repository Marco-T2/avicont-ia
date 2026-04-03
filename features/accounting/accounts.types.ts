import type { Account, AccountType } from "@/generated/prisma/client";

// ── Input types ──

export interface CreateAccountInput {
  code: string;
  name: string;
  type: AccountType;
  parentId?: string;
  level: number;
}

export interface UpdateAccountInput {
  name?: string;
  isActive?: boolean;
}

// ── Composite types ──

export type AccountWithChildren = Account & {
  children: Account[];
};
