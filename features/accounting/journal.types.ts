import type {
  JournalEntry,
  JournalLine,
  Account,
  JournalEntryStatus,
} from "@/generated/prisma/client";

// ── Input types ──

export interface JournalLineInput {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
  contactId?: string;
  order: number;
}

export interface CreateJournalEntryInput {
  date: Date;
  description: string;
  periodId: string;
  voucherTypeId: string;
  contactId?: string;
  sourceType?: string;
  sourceId?: string;
  createdById: string;
  lines: JournalLineInput[];
}

export interface UpdateJournalEntryInput {
  date?: Date;
  description?: string;
  contactId?: string | null;
  updatedById: string;
  lines?: JournalLineInput[];
}

// ── Filter types ──

export interface JournalFilters {
  dateFrom?: Date;
  dateTo?: Date;
  periodId?: string;
  voucherTypeId?: string;
  status?: JournalEntryStatus;
}

// ── Composite types ──

export type JournalLineWithAccount = JournalLine & {
  account: Account;
};

export type JournalEntryWithLines = JournalEntry & {
  lines: JournalLineWithAccount[];
};
