/**
 * Pure output types for tool executors in the application layer.
 * Domain layer: no server-only, no Prisma, no SDK deps.
 */

import type { ContactType } from "@/generated/prisma/client";

export interface FindAccountsResultItem {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
  requiresContact: boolean;
}

export interface FindAccountsResult {
  accounts: FindAccountsResultItem[];
  configRequired: boolean;
  message?: string;
}

export interface FindContactResultItem {
  id: string;
  name: string;
  nit: string | null;
  type: ContactType;
}

export interface FindContactResult {
  contacts: FindContactResultItem[];
  matchedExactly?: string;
}
