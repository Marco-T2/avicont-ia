/**
 * INSIDE-TX bulk creator for the 12 year+1 FiscalPeriods (design rev 2 §4
 * + §5; spec REQ-5.1 + REQ-5.2).
 *
 * Tx-bound — enters `AnnualCloseScope` via scope-membership; method signature
 * has NO `tx` parameter (R5 NO Prisma leak).
 *
 * Hexagonal layer 1 — pure TS, no infra imports. Adapter (Phase 4) wraps
 * Prisma `createMany`/`create` against the open TX client.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * **Defensive TOCTOU gate** (spec REQ-5.2): adapter MUST `count` existing
 * FiscalPeriod rows for `(orgId, year)` FIRST. Any count > 0 → throw
 * `YearOpeningPeriodsExistError`. This catches the case where year+1 was
 * partially initialised between the pre-TX gate and the TX entry.
 *
 * **W-4 contingency** (audit-trigger DDL inspection): if the existing
 * `fiscal_periods` audit trigger does NOT fire per-row on `createMany` (i.e.
 * it is statement-level), the adapter MUST fall back to a per-row `create`
 * loop to preserve audit-trail completeness. The Phase 8 acceptance test
 * (`audit-trail.integration.test.ts`) gates the decision: ≥17 audit rows
 * per correlationId for the standard path.
 *
 * **Period naming + ranges** (REQ-5.1): names follow Spanish month convention
 * (`Enero <year>`, ..., `Diciembre <year>`); date ranges via
 * `MonthlyRange.of(year, month)`; all 12 periods seeded as `status=OPEN`.
 */

export interface CreateTwelvePeriodsInput {
  organizationId: string;
  year: number;
  createdById: string;
}

export interface CreateTwelvePeriodsResult {
  /** Ids of all 12 newly-created periods, ordered by month ascending. */
  periodIds: string[];
  /** Convenience handle for the January period (target for CA voucher). */
  janPeriodId: string;
}

export interface PeriodAutoCreatorTxPort {
  /**
   * Create the 12 FiscalPeriods for `year` in a single TX-bound operation.
   *
   * Invariants (see file-level JSDoc):
   *   - Pre-existing rows → `YearOpeningPeriodsExistError` (REQ-5.2 — strict).
   *   - Spanish month names + `MonthlyRange.of()` ranges + `status=OPEN`.
   *   - Audit-trail completeness via per-row `create` fallback if `createMany`
   *     skips the per-row trigger (W-4).
   */
  createTwelvePeriodsForYear(
    input: CreateTwelvePeriodsInput,
  ): Promise<CreateTwelvePeriodsResult>;
}
