import type Decimal from "decimal.js";

/**
 * INSIDE-TX journal-entry writer port for the annual-close CC + CA vouchers
 * (design rev 2 §4 + §5).
 *
 * Tx-bound — enters `AnnualCloseScope` via scope-membership; method signature
 * has NO `tx` parameter (R5 NO Prisma leak — mirror monthly-close
 * `PeriodLockingWriterPort` pattern EXACT).
 *
 * Hexagonal layer 1 — pure TS, no infra imports. DEC-1: `lines[].debit` and
 * `lines[].credit` are `decimal.js` Decimals; the adapter casts at the SQL
 * boundary to `new Prisma.Decimal(d.toString())` (infrastructure layer is the
 * ONLY DEC-1 escape).
 *
 * ──────────────────────────────────────────────────────────────────────────
 * **REQ-2.7 — Port-level period-status invariant (C-5)**.
 *
 * The annual-close writer bypasses `JournalsService.validateAndCreateDraft`
 * (which classically enforces "no JE into CLOSED period") because:
 *   a) we arrive with pre-computed `Decimal` lines, NOT draft inputs, and
 *   b) we post directly as POSTED (no draft → validate → post lifecycle).
 *
 * Therefore the adapter MUST, INSIDE the same TX and BEFORE inserting the
 * JournalEntry:
 *   1. Re-read the target `FiscalPeriod` (input.periodId) via the TX-bound
 *      Prisma client.
 *   2. Assert `period.status === "OPEN"`. If not OPEN → throw
 *      `PeriodAlreadyClosedError({ periodId, status })`.
 *   3. Period not found → throw `NotFoundError` (defensive — should not
 *      happen given pre-TX validation, but the writer cannot trust the
 *      caller's TOCTOU re-reads).
 *
 * The invariant applies to BOTH inserts (CC into Dec, CA into Jan year+1).
 *
 * ──────────────────────────────────────────────────────────────────────────
 * **W-1 — Voucher correlative race-safety**.
 *
 * The adapter MUST resolve the voucher `number` via the canonical
 * `JournalRepository.createWithRetryTx` at
 * `modules/accounting/infrastructure/prisma-journal-entries.repo.ts:268`.
 * Inline `MAX(number) + 1` is FORBIDDEN — proven race-unsafe (REQ-B.2,
 * `get-next-number-concurrency.test.ts`). Reusing `createWithRetryTx` also
 * piggybacks `accountBalances.applyPost(snapshot, tx)` automatically for the
 * POSTED status (design rev 2 §5).
 *
 * ──────────────────────────────────────────────────────────────────────────
 * **DEC-1 boundary**. The adapter is the ONLY place `decimal.js Decimal` is
 * converted into `Prisma.Decimal`: `new Prisma.Decimal(d.toString())`. Domain
 * and application layers stay `decimal.js`-pure.
 */

export type AnnualClosingVoucherCode = "CC" | "CA";

export interface AnnualClosingLineInput {
  accountId: string;
  debit: Decimal;
  credit: Decimal;
  description?: string;
}

export interface AnnualClosingEntryInput {
  organizationId: string;
  periodId: string;
  date: Date;
  voucherTypeCode: AnnualClosingVoucherCode;
  description: string;
  createdById: string;
  /**
   * Annual-close source linkage — used by audit + cross-module reverse-lookup
   * (`getInitialBalanceFromCAForYear`). Mirrors `monthly-close` sourceType
   * convention; value MUST be `"annual-close"` at the call site (design
   * rev 2 §3 + §5).
   */
  sourceType: "annual-close";
  /** FiscalYear id — populates `JournalEntry.sourceId` for audit traceability. */
  sourceId: string;
  lines: AnnualClosingLineInput[];
}

export interface AnnualClosingEntryResult {
  /** Newly-created JournalEntry id (POSTED). */
  entryId: string;
}

export interface AnnualClosingJournalWriterTxPort {
  /**
   * Create + post a CC or CA voucher INSIDE the open TX.
   *
   * Adapter invariants (see file-level JSDoc above):
   *   - REQ-2.7 / C-5: re-read period status; throw `PeriodAlreadyClosedError`
   *     if not OPEN.
   *   - W-1: voucher number via `JournalRepository.createWithRetryTx`; inline
   *     `MAX(number)+1` FORBIDDEN.
   *   - DEC-1 boundary: `new Prisma.Decimal(d.toString())` only inside the
   *     adapter, never in domain/application.
   */
  createAndPost(
    input: AnnualClosingEntryInput,
  ): Promise<AnnualClosingEntryResult>;
}
