/**
 * INSIDE-TX writer port for the FiscalYear aggregate (design rev 2 §4 + §5).
 *
 * Tx-bound — enters the `AnnualCloseScope` via scope-membership; methods do
 * NOT take a `tx` parameter (R5 NO Prisma leak; mirror monthly-close
 * `PeriodLockingWriterPort` pattern EXACT).
 *
 * Hexagonal layer 1 — pure TS, no infra imports. Adapter (Phase 4) wraps
 * `Prisma.TransactionClient`.
 *
 * **W-3 invariant** (`markClosed` MUST be guarded):
 * Adapter MUST express the write as `UPDATE fiscal_years SET status='CLOSED', ...
 * WHERE id = ? AND status = 'OPEN'`. If affected-rows !== 1 → throw
 * `FiscalYearAlreadyClosedError` and abort the TX (spec REQ-1.2 + REQ-2.5
 * lost-update protection). The aggregate-level guard in
 * `FiscalYear.markClosed` only catches in-process double-calls; the DB
 * predicate catches concurrent annual-close TXs racing on the same `(orgId,
 * year)`.
 */

export interface UpsertOpenInput {
  organizationId: string;
  year: number;
  createdById: string;
}

export interface UpsertOpenResult {
  /** FiscalYear id (existing or newly-created). */
  id: string;
}

export interface MarkClosedInput {
  fiscalYearId: string;
  closedBy: string;
}

export interface MarkClosedResult {
  /** Server-stamped close timestamp (UTC). */
  closedAt: Date;
}

export interface FiscalYearWriterTxPort {
  /**
   * Idempotent INSERT ... ON CONFLICT DO NOTHING for (orgId, year) with
   * `status=OPEN`. Returns the resulting FiscalYear id whether it was just
   * created or pre-existed. Adapter MUST use the unique index `(organizationId,
   * year)` defined in `prisma/schema.prisma`. Safe to retry.
   */
  upsertOpen(input: UpsertOpenInput): Promise<UpsertOpenResult>;

  /**
   * Guarded OPEN → CLOSED transition (W-3). Adapter MUST issue
   * `updateMany({ where: { id, status: "OPEN" }, data: {...} })` (or the
   * equivalent raw SQL) and verify `count === 1`; count=0 → throw
   * `FiscalYearAlreadyClosedError`. The TX rolls back, preventing orphan
   * CC/CA vouchers (spec REQ-2.5).
   */
  markClosed(input: MarkClosedInput): Promise<MarkClosedResult>;
}
