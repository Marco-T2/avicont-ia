import type {
  JournalEntry,
  JournalLine,
  Account,
  VoucherType,
} from "@/generated/prisma/client";

// ── Input types ──

export interface JournalLineInput {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface CreateJournalEntryInput {
  date: Date;
  description: string;
  voucherType: VoucherType;
  createdById: string;
  lines: JournalLineInput[];
}

// ── Filter types ──

export interface JournalFilters {
  dateFrom?: Date;
  dateTo?: Date;
  voucherType?: VoucherType;
}

// ── Composite types ──

export type JournalLineWithAccount = JournalLine & {
  account: Account;
};

export type JournalEntryWithLines = JournalEntry & {
  lines: JournalLineWithAccount[];
};
