import type {
  AccountsReceivable,
  ReceivableStatus,
  Contact,
} from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";

// ── Re-export Prisma types for convenience ──

export type { AccountsReceivable, ReceivableStatus };

// ── Composite types ──

export type ReceivableWithContact = AccountsReceivable & {
  contact: Contact;
};

// ── Input types ──

export interface CreateReceivableInput {
  contactId: string;
  description: string;
  amount: Prisma.Decimal | number | string;
  dueDate: Date;
  sourceType?: string;
  sourceId?: string;
  journalEntryId?: string;
  notes?: string;
}

export interface UpdateReceivableInput {
  description?: string;
  dueDate?: Date;
  sourceType?: string;
  sourceId?: string;
  journalEntryId?: string;
  notes?: string;
}

export interface UpdateReceivableStatusInput {
  status: ReceivableStatus;
  paidAmount?: Prisma.Decimal | number | string;
}

export interface ReceivableFilters {
  contactId?: string;
  status?: ReceivableStatus;
  dueDateFrom?: Date;
  dueDateTo?: Date;
}

export interface OpenAggregate {
  totalBalance: Prisma.Decimal;
  count: number;
}
