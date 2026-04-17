import type {
  JournalEntry,
  JournalLine,
  Account,
  JournalEntryStatus,
  Contact,
  VoucherTypeCfg,
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
  referenceNumber?: number;
  createdById: string;
  lines: JournalLineInput[];
}

export interface UpdateJournalEntryInput {
  date?: Date;
  description?: string;
  contactId?: string | null;
  referenceNumber?: number | null;
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
  origin?: "manual" | "auto" | "all";
}

// ── Composite types ──

export type JournalLineWithAccount = JournalLine & {
  account: Account;
  contact?: Contact | null;
};

export type JournalEntryWithLines = JournalEntry & {
  lines: JournalLineWithAccount[];
  contact?: Contact | null;
  voucherType: VoucherTypeCfg;
};

// ── Correlation audit types ──

export interface CorrelationAuditFilters {
  voucherTypeId: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface ReferenceNumberEntry {
  id: string;
  referenceNumber: number;
  date: Date;
  number: number;
  description: string;
}

export interface CorrelationGap {
  from: number;
  to: number;
  count: number;
}

export interface CorrelationAuditResult {
  entries: ReferenceNumberEntry[];
  gaps: CorrelationGap[];
  totalEntries: number;
  entriesWithoutReference: number;
  hasGaps: boolean;
}
