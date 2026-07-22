/** Canonical hex DTO — journal input/filter/composite types (§13.X). */
import type { Decimal } from "decimal.js";
import type { Account } from "./accounts.types";
import type { JournalEntryStatus } from "./value-objects/journal-entry-status";
import type { VoucherTypeSnapshot } from "@/modules/voucher-types/domain/voucher-type.entity";
import type { OperationalDocTypeSnapshot } from "@/modules/operational-doc-type/domain/operational-doc-type.entity";

// ── Entity types (D4: domain-owned model types) ──

/**
 * Espejo estructural de los scalars del modelo Prisma `JournalEntry` (sin
 * relaciones — viven en `JournalEntryWithLines`). Drift risk: sin sync test;
 * tsc en los adapters detecta divergencia (precedente: `Account` D4).
 */
export interface JournalEntry {
  id: string;
  number: number;
  referenceNumber: number | null;
  date: Date;
  description: string;
  status: JournalEntryStatus;
  periodId: string;
  voucherTypeId: string;
  contactId: string | null;
  operationalDocTypeId: string | null;
  sourceType: string | null;
  sourceId: string | null;
  aiOriginalText: string | null;
  organizationId: string;
  createdById: string;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Espejo estructural de los scalars del modelo Prisma `JournalLine` (sin
 * relaciones — viven en `JournalLineWithAccount`). `debit`/`credit` usan
 * `Decimal` de decimal.js (DEC-1), estructuralmente idéntico al de Prisma.
 * Drift risk: sin sync test; tsc en los adapters detecta divergencia.
 */
export interface JournalLine {
  id: string;
  journalEntryId: string;
  accountId: string;
  debit: Decimal;
  credit: Decimal;
  description: string | null;
  contactId: string | null;
  order: number;
}

/**
 * Relación `contact` mínima raw-row-assignable: los composites solo leen
 * `.name`, y un row Prisma `Contact` completo asigna por width subtyping.
 * NO se reusa `ContactSnapshot` (creditLimit number vs Decimal del raw row).
 */
export interface JournalContactRef {
  id: string;
  name: string;
}

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
  // Physical document type FK (journal-physical-document) — optional at the
  // repo layer too so legacy callers continue working unchanged.
  operationalDocTypeId?: string | null;
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
  operationalDocTypeId?: string | null;
  updatedById: string;
  lines?: JournalLineInput[];
}

// ── Filter types ──

export interface JournalFilters {
  dateFrom?: Date;
  dateTo?: Date;
  periodId?: string;
  /** Filters entries whose period belongs to the given fiscal year (4-digit).
   *  Composes with `periodId` via AND — incoherent combinations (year mismatching
   *  periodId's year) yield empty results by design. */
  year?: number;
  voucherTypeId?: string;
  status?: JournalEntryStatus;
  origin?: "manual" | "auto" | "all";
}

// ── Composite types ──

export type JournalLineWithAccount = JournalLine & {
  account: Account;
  contact?: JournalContactRef | null;
};

export type JournalEntryWithLines = JournalEntry & {
  lines: JournalLineWithAccount[];
  contact?: JournalContactRef | null;
  voucherType: VoucherTypeSnapshot;
  // journal-physical-document — eager-hydrated via journalIncludeLines so
  // contact-ledger reads `je.operationalDocType.code` direct + detail view
  // renders code + name without follow-up query. Nullable: legacy/manual JEs
  // without a doc type set keep it null.
  operationalDocType?: OperationalDocTypeSnapshot | null;
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
