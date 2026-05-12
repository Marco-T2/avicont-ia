/** Canonical hex DTO — journal input/filter/composite types (§13.X). */
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
  // Fecha calendario del asiento como UTC midnight. Si construís este input
  // desde un string ISO crudo (LLM, integraciones), usá `parseEntryDate` de
  // `./journal.dates` — `new Date(rawString)` puede caer en el día siguiente
  // cuando el offset cruza la medianoche UTC.
  date: Date;
  description: string;
  periodId: string;
  voucherTypeId: string;
  contactId?: string;
  sourceType?: string;
  sourceId?: string;
  referenceNumber?: number;
  createdById: string;
  // Texto crudo del usuario cuando el asiento se origina vía agente IA. Se persiste
  // junto al entry e inmutable post-creación (no se expone en updateEntry). Lo usa
  // el route handler de captura asistida — el form normal de "+ Nuevo Asiento" lo
  // omite y queda null.
  aiOriginalText?: string;
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
