import type Decimal from "decimal.js";

/**
 * Outside-TX year-aggregate reader (NoTx variant, design rev 2 §4).
 *
 * Powers the pre-TX year-balance gate (spec REQ-2.1) + `getSummary` outside-TX
 * use case (axis-distinct from the inside-TX TOCTOU re-assert).
 *
 * **C-1 + C-4 invariant** (year-aggregate, unconditional):
 * `aggregateYearDebitCreditNoTx` MUST sum `(SUM(debit), SUM(credit))` across
 * ALL POSTED `journal_lines` whose `fiscalPeriod.year = year` for the org —
 * NOT per-period sums. The pre-TX gate evaluates this UNCONDITIONALLY, even
 * on the edge path (all 12 months already CLOSED). Skipping the gate on the
 * edge path was C-4 in the adversarial review.
 *
 * Hexagonal layer 1 — pure TS, no infra imports. DEC-1: return `decimal.js`
 * `Decimal` values (adapter casts SQL `::numeric(18,2)::text` → `new Decimal(str)`
 * at the boundary).
 */

export interface YearAggregateBalance {
  debit: Decimal;
  credit: Decimal;
}

export interface YearAccountingReaderPort {
  /**
   * Year-aggregate POSTED `(debit, credit)` totals across ALL 12 months of
   * the year for the organization. Pre-TX gate (spec REQ-2.1 — unconditional,
   * C-1/C-4). NO per-period decomposition — single aggregate query.
   */
  aggregateYearDebitCreditNoTx(
    organizationId: string,
    year: number,
  ): Promise<YearAggregateBalance>;
}
