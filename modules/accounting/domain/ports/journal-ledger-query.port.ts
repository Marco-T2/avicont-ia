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
 *  date/number/description. Mirrors the legacy `findLinesByAccount` select. */
export interface LedgerLineRow {
  debit: unknown;
  credit: unknown;
  description: string | null;
  journalEntry: {
    date: Date;
    number: number;
    description: string;
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

  /** Aggregated debit/credit totals for one account in one period. */
  aggregateByAccount(
    organizationId: string,
    accountId: string,
    periodId: string,
  ): Promise<LedgerAggregateRow>;
}
