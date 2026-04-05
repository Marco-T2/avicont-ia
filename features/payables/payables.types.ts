import type {
  AccountsPayable,
  PayableStatus,
  Contact,
} from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";

// ── Re-export Prisma types for convenience ──

export type { AccountsPayable, PayableStatus };

// ── Composite types ──

export type PayableWithContact = AccountsPayable & {
  contact: Contact;
};

// ── Input types ──

export interface CreatePayableInput {
  contactId: string;
  description: string;
  amount: Prisma.Decimal | number | string;
  dueDate: Date;
  sourceType?: string;
  sourceId?: string;
  journalEntryId?: string;
  notes?: string;
}

export interface UpdatePayableInput {
  description?: string;
  dueDate?: Date;
  sourceType?: string;
  sourceId?: string;
  journalEntryId?: string;
  notes?: string;
}

export interface UpdatePayableStatusInput {
  status: PayableStatus;
  paidAmount?: Prisma.Decimal | number | string;
}

export interface PayableFilters {
  contactId?: string;
  status?: PayableStatus;
  dueDateFrom?: Date;
  dueDateTo?: Date;
}

export interface OpenAggregate {
  totalBalance: Prisma.Decimal;
  count: number;
}
