import type {
  CorrelationAuditFilters,
  CorrelationAuditResult,
  JournalEntryWithLines,
  JournalFilters,
} from "@/modules/accounting/presentation/dto/journal.types";
import type { DateRangeFilter } from "@/modules/accounting/presentation/dto/ledger.types";
import type {
  PaginatedResult,
  PaginationOptions,
} from "@/modules/shared/domain/value-objects/pagination";

/**
 * Read/query port for the journal-ledger module (POC #7 OLEADA 6 — C1).
 *
 * Hosts the NON-TX read surface the legacy `journal.service.ts` + `ledger.
 * service.ts` exposed by reaching into `JournalRepository` directly. The hex
 * `JournalsService` (5 read use cases) and `LedgerService` (libro-mayor)
 * delegate here instead of importing the Prisma repo — the application layer
 * stays port-driven.
 *
 * Distinct from `JournalEntriesReadPort`: that port returns the `Journal`
 * AGGREGATE (hydrated for the write use cases that need invariant-bearing
 * domain behaviour). This port returns the legacy ROW shapes
 * (`JournalEntryWithLines`, `CorrelationAuditResult`, aggregates) verbatim —
 * the read use cases are projection/reporting paths with no aggregate
 * behaviour, so re-hydrating into `Journal` would be lossy noise. Parity-true
 * with legacy `journal.service.ts` (`list`/`getById`/`getCorrelationAudit`/
 * `getLastReferenceNumber`/`getNextNumber`) and `ledger.service.ts`
 * (`findLinesByAccount`/`aggregateByAccount`).
 *
 * Adapter (`PrismaJournalLedgerQueryAdapter`) delegates to the hex
 * `JournalRepository` folded into `prisma-journal-entries.repo.ts` at C0.
 *
 * Money math: the libro-mayor query results carry raw `Prisma.Decimal` debit/credit
 * values; `LedgerService` wraps them as `new Prisma.Decimal(value)` and performs
 * arbitrary-precision arithmetic (`sumDecimals` + `.minus()` chain + `roundHalfUp`)
 * from `shared/domain/money.utils`. This port is the pure data boundary —
 * no money math here. R-money discharged per poc-money-math-decimal-convergence
 * (OLEADA 7 POC #2).
 */

/** A journal line projected for the libro-mayor view, with its parent entry's
 *  date/number/description + entry id + voucher type (code+prefix) para que la
 *  UI pueda mostrar el tipo de comprobante y enlazar al detail del asiento. */
export interface LedgerLineRow {
  debit: unknown;
  credit: unknown;
  description: string | null;
  journalEntry: {
    id: string;
    date: Date;
    number: number;
    description: string;
    voucherType: {
      code: string;
      prefix: string;
    };
  };
}

/** Aggregated debit/credit totals for one account in one period. Mirrors the
 *  legacy `aggregateByAccount` `_sum` shape. */
export interface LedgerAggregateRow {
  _sum: {
    debit: unknown;
    credit: unknown;
  };
}

/** A journal line projected for the CONTACT-keyed ledger view (CxC/CxP libro
 *  por cliente / proveedor). Extends `LedgerLineRow` with the JournalEntry's
 *  source-document discriminators so the application layer can hydrate
 *  status / paymentMethod / bankAccount from the matching
 *  Receivable / Payable / Payment / Receipt without N+1 (design D3).
 *
 *  `sourceType`/`sourceId` mirror the persistence columns on JournalEntry
 *  (nullable for manual asientos sin auxiliar — D4 "withoutAuxiliary"
 *  flagging). Service treats `sourceType=null AND no CxC/CxP match` as
 *  a `withoutAuxiliary: true` row. */
export interface ContactLedgerLineRow extends LedgerLineRow {
  sourceType: string | null;
  sourceId: string | null;
}

/** Page-window of contact-keyed journal lines + opening balance delta. Same
 *  pagination + opening-balance contract as `LedgerPageResult` (account-keyed
 *  sister), with `items` narrowed to `ContactLedgerLineRow[]` so the
 *  application layer reads source discriminators without a re-cast. */
export interface ContactLedgerPageResult {
  items: ContactLedgerLineRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /** Decimal value (Prisma.Decimal at adapter) representing
   *  sum(debit) - sum(credit) of ALL prior-page rows for this contact.
   *  Page 1 → 0. Service coerces via `new Decimal(String(...))` (DEC-1). */
  openingBalanceDelta: unknown;
}

/** Page-window of journal lines for one account, with opening balance delta
 *  to seed the running-balance accumulator. Split-port 3-touchpoint cascade
 *  (§13/split-port-three-touchpoint-find-paginated — 2nd evidence Journal 1st
 *  → Ledger 2nd, same port carries findPaginated AND findLinesByAccountPaginated).
 *  Cumulative-state paginated DTO — extends PaginatedResult<T> shape with
 *  openingBalanceDelta WITHOUT polluting the shared VO (§13 NEW candidate
 *  cumulative-state-paginated-dto-pattern, 1st evidence). */
export interface LedgerPageResult {
  items: LedgerLineRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /** Decimal value (Prisma.Decimal at adapter) representing
   *  sum(debit) - sum(credit) of all rows BEFORE the current page window.
   *  Page 1 → 0. Service coerces via `new Prisma.Decimal(String(...))`.
   *  Mirrors LedgerLineRow.debit/credit: unknown port-edge pattern —
   *  port boundary does NOT bleed Prisma.Decimal typing. */
  openingBalanceDelta: unknown;
}

export interface JournalLedgerQueryPort {
  // ── Journal reads (5 — power JournalsService read use cases) ──

  /** All entries for an org, optionally filtered. Parity legacy `repo.findAll`. */
  list(
    organizationId: string,
    filters?: JournalFilters,
  ): Promise<JournalEntryWithLines[]>;

  /**
   * Paginated entries for an org. Split-port 3-touchpoint cascade — port +
   * adapter + repo all carry `findPaginated`. §13/journal-ledger-query-port-
   * split-findpaginated-three-touchpoints 1ra evidencia.
   */
  findPaginated(
    organizationId: string,
    filters?: JournalFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<JournalEntryWithLines>>;

  /** Single entry by id, or null when missing. Parity legacy `repo.findById`. */
  findById(
    organizationId: string,
    id: string,
  ): Promise<JournalEntryWithLines | null>;

  /** Highest existing `referenceNumber` for a voucher type, or null. */
  getLastReferenceNumber(
    organizationId: string,
    voucherTypeId: string,
  ): Promise<number | null>;

  /** Next sequential `number` for {org, voucherType, period}. */
  getNextNumber(
    organizationId: string,
    voucherTypeId: string,
    periodId: string,
  ): Promise<number>;

  /** Reference-numbered + un-referenced entries for gap-detection. The
   *  gap-detection ITSELF stays in the use case (parity legacy
   *  `journal.service.ts:524-535`). */
  findForCorrelationAudit(
    organizationId: string,
    voucherTypeId: string,
    filters?: Pick<CorrelationAuditFilters, "dateFrom" | "dateTo">,
  ): Promise<{
    withReference: CorrelationAuditResult["entries"];
    withoutReferenceCount: number;
  }>;

  // ── Libro-mayor reads (2 — power LedgerService) ──

  /** POSTED journal lines for one account, optionally date/period filtered.
   *  Ordered by parent entry date asc — running-balance order. */
  findLinesByAccount(
    organizationId: string,
    accountId: string,
    filters?: { dateRange?: DateRangeFilter; periodId?: string },
  ): Promise<LedgerLineRow[]>;

  /** Paginated POSTED journal lines for one account + opening balance delta.
   *  Same dateRange + periodId filter contract as findLinesByAccount; additive
   *  parallel method (dual-method transitional, 5th evidence). 3-query
   *  Promise.all at the Prisma adapter: rows window + count + prior rows for
   *  openingBalanceDelta. */
  findLinesByAccountPaginated(
    organizationId: string,
    accountId: string,
    filters?: { dateRange?: DateRangeFilter; periodId?: string },
    pagination?: PaginationOptions,
  ): Promise<LedgerPageResult>;

  /** Aggregated debit/credit totals for one account in one period. */
  aggregateByAccount(
    organizationId: string,
    accountId: string,
    periodId: string,
  ): Promise<LedgerAggregateRow>;

  // ── Contact-keyed libro reads (3 — power LedgerService.getContactLedger*) ──

  /** Paginated POSTED journal lines for one contact (CxC/CxP libro) +
   *  opening balance delta. Mirror of `findLinesByAccountPaginated` keyed by
   *  contact instead of account. Filter contract identical (date range +
   *  optional period). Adapter resolves rows where
   *  `journalEntry.contactId = X` OR `line.contactId = X` (design D4) so the
   *  "asiento manual sin auxiliar" case surfaces; service flags
   *  `withoutAuxiliary` post-hoc. */
  findLinesByContactPaginated(
    organizationId: string,
    contactId: string,
    filters?: { dateRange?: DateRangeFilter; periodId?: string },
    pagination?: PaginationOptions,
  ): Promise<ContactLedgerPageResult>;

  /** Opening balance scalar for one contact at `dateFrom`. Returned as the
   *  same opaque `unknown` shape as `openingBalanceDelta` — Prisma.Decimal
   *  at the adapter, decimal.js Decimal at the service via
   *  `new Decimal(String(...))` (DEC-1). Powers the "Saldo inicial" row that
   *  precedes the first paginated rows in the contact-ledger UI. */
  findOpeningBalanceByContact(
    organizationId: string,
    contactId: string,
    dateFrom: Date,
  ): Promise<unknown>;

  /** All-time aggregated debit/credit totals for one contact (open-balance
   *  dashboard query). Same `_sum` shape as `aggregateByAccount` so callers
   *  reuse the existing extraction helpers without branching. NOT
   *  period-scoped: open balance is cumulative since the contact's first
   *  POSTED movement. */
  aggregateOpenBalanceByContact(
    organizationId: string,
    contactId: string,
  ): Promise<LedgerAggregateRow>;
}
