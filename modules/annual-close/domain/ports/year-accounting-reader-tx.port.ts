import type Decimal from "decimal.js";
import type { YearAggregateBalance } from "./year-accounting-reader.port";
import type {
  AccountNature,
  AccountType,
} from "../types/accounting-types";

/**
 * INSIDE-TX year-aggregate reader (design rev 2 §4 + §5).
 *
 * Powers steps (a'), (b), (c), (f) of the close orchestration:
 *   (a') TOCTOU re-reads (W-2) — FY/Dec/CC status snapshots inside the TX.
 *   (b)  Year-balance re-assert (C-1/C-4) — same shape as NoTx, tx-bound.
 *   (c)  CC source: per-account INGRESO/GASTO aggregates with `nature` for
 *        the signed-net algorithm (C-2 — cc-line.builder consumes).
 *   (f)  CA source: delta-from-most-recent-prior-CA merged with prevCA
 *        per-account contribution (C-3 — ca-line.builder consumes).
 *
 * Hexagonal layer 1 — pure TS, no infra imports. DEC-1: `decimal.js` Decimal
 * values at the boundary; adapter casts `::numeric(18,2)::text` → `new
 * Decimal(str)`.
 *
 * **Snapshot LOCAL primitives** mirror precedent
 * (`MonthlyCloseFiscalPeriod` C1 pattern). TOCTOU re-read return shapes are
 * intentionally narrow — just the field the orchestrator compares.
 *
 * **YearAggregatedLine** is re-exported from `cc-line.builder` (the canonical
 * shape used by both CC and CA builders per design rev 2 §4).
 */

export interface AnnualClosePeriodStatus {
  status: "OPEN" | "CLOSED";
}

export interface AnnualCloseFiscalYearStatus {
  status: "OPEN" | "CLOSED";
}

/**
 * Per-account aggregate row consumed by `cc-line.builder` (REQ-3.3) and
 * `ca-line.builder` (REQ-4.2). `nature` drives the signed-net side selection;
 * `type` lets the builders filter INGRESO/GASTO (CC) vs ACTIVO/PASIVO/PATRIMONIO
 * (CA).
 */
export interface YearAggregatedLine {
  accountId: string;
  code: string;
  nature: AccountNature;
  type: AccountType;
  subtype: string | null;
  debit: Decimal;
  credit: Decimal;
}

export interface YearAccountingReaderTxPort {
  /**
   * INSIDE-TX year-aggregate re-assert (spec REQ-2.2 step 2). Same shape
   * + semantics as the NoTx variant — distinct port to keep the tx-bound
   * adapter wiring explicit (scope-membership pattern).
   */
  aggregateYearDebitCredit(
    organizationId: string,
    year: number,
  ): Promise<YearAggregateBalance>;

  /**
   * CC source query (REQ-3.3 — C-2). Returns one row per INGRESO/GASTO LEAF
   * account that had any movement in the year, with raw `(debit, credit)`
   * sums + `nature`. Rows with `debit=0 AND credit=0` filtered at the SQL
   * `HAVING` level. The builder applies the signed-net algorithm.
   */
  aggregateResultAccountsByYear(
    organizationId: string,
    year: number,
  ): Promise<YearAggregatedLine[]>;

  /**
   * CA source query (REQ-4.2 — C-3 delta-from-most-recent-prior-CA).
   *
   * Three-step adapter logic (design rev 2 §5):
   *  1. Find `prevCAdate` — most-recent prior CA strictly before
   *     `${year}-12-31` (null on inception).
   *  2. Aggregate `(SUM(debit), SUM(credit))` per ACTIVO/PASIVO/PATRIMONIO
   *     LEAF account for POSTED `journal_lines` with
   *     `je.date > prevCAdate AND je.date <= ${year}-12-31` (INCLUDES the
   *     just-posted CC). If `prevCAdate IS NULL` → inception fallback
   *     (`je.date <= ${year}-12-31`).
   *  3. If prior CA exists, sum its per-account contribution row-by-row
   *     (in-memory merge — sum delta + prevCA per accountId).
   *
   * The naïve "sum from inception ≤ year-12-31" path is FORBIDDEN — it would
   * double-count prior-CA-era movements already captured in prevCA (C-3).
   * Zero-balance accounts surviving the merge are kept in the builder's
   * skip-if-net-zero step (NOT filtered at the SQL level because prevCA
   * contribution may revive a zero-delta account).
   */
  aggregateBalanceSheetAccountsForCA(
    organizationId: string,
    year: number,
  ): Promise<YearAggregatedLine[]>;

  /**
   * Tx-bound result-account lookup. Used by step (c) to guard against the
   * (very unlikely) race where the chart of accounts loses `3.2.2` between
   * pre-TX and TX. Throws `MissingResultAccountError` at the caller; the
   * port returns null per snapshot convention.
   */
  findResultAccount(
    organizationId: string,
  ): Promise<{ id: string; code: string; nature: AccountNature } | null>;

  // ── TOCTOU re-reads (W-2 — spec REQ-2.2 step (a')) ──────────────────────

  /**
   * Re-read FiscalYear `status` INSIDE the TX. Null when the row vanished
   * (defensive — should not happen post-upsertOpen). Status !== "OPEN" →
   * `FiscalYearAlreadyClosedError` and rollback.
   */
  reReadFiscalYearStatusTx(
    fiscalYearId: string,
  ): Promise<AnnualCloseFiscalYearStatus | null>;

  /**
   * Re-read FiscalPeriod `status` INSIDE the TX. Null when the row vanished
   * (defensive). Status mismatch vs expected (OPEN for standard path, CLOSED
   * for edge path) → typed error and rollback.
   */
  reReadPeriodStatusTx(
    periodId: string,
  ): Promise<AnnualClosePeriodStatus | null>;

  /**
   * Re-read whether a POSTED CC voucher dated within `${year}` exists, INSIDE
   * the TX. True → another annual-close already committed for this year →
   * `FiscalYearGateNotMetError` and rollback.
   */
  reReadCcExistsForYearTx(
    organizationId: string,
    year: number,
  ): Promise<boolean>;
}
