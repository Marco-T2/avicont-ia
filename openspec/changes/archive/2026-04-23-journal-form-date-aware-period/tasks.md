# Tasks: Journal Form — Date-Aware Period Auto-Selection

**Change**: `journal-form-date-aware-period`
**Date**: 2026-04-23
**TDD Mode**: Strict — RED before GREEN for every unit of behavior.

---

## Phase 0: SDD Option-2 Check-in Report

- [x] T-0 Report (4 points):
  1. **Inputs read**: proposal.md, spec (journal-entry-form-ux), design.md — all confirmed.
  2. **Invariant collision pre-scan**: No collisions. `findPeriodCoveringDate` is a new export; `periodManuallySelected` is a new local state; warning banner is additive. No existing requirement is modified.
  3. **Retirement inventory**: Pure additive change. No files deleted, no existing logic removed. `periodId` init at line 87 of `journal-entry-form.tsx` will be superseded by the `useEffect` but the initial value remains as a safe default for the first render tick.
  4. **Test baseline**: 2718 passing before Phase 2 (2713 original + 5 helper tests from Phase 1 already committed).

---

## Phase 1: Helper Foundation (TDD)

- [x] T-1.a **(RED)** Create `features/fiscal-periods/__tests__/period-helpers.test.ts` with 5 failing unit tests for `findPeriodCoveringDate`:
  - Case 1: date inside range → returns matching OPEN period
  - Case 2: date = `startDate` (inclusive boundary) → matches
  - Case 3: date = `endDate` (inclusive boundary) → matches
  - Case 4: no OPEN period covers date → returns null
  - Case 5: period covers date but status ≠ OPEN → returns null (non-OPEN ignored)

- [x] T-1.b **(GREEN)** Create `features/fiscal-periods/period-helpers.ts` — implement `findPeriodCoveringDate(date: string, periods: FiscalPeriod[]): FiscalPeriod | null`. Comparison: `p.startDate.toISOString().slice(0,10) <= date && date <= p.endDate.toISOString().slice(0,10)`. All 5 T-1.a tests must pass.

- [x] T-1.c **(CHORE)** Add `export * from "./period-helpers"` to `features/fiscal-periods/index.ts`. Confirm no TS errors.

---

## Phase 2: Component Wiring (TDD — scenario per RED/GREEN pair)

**Note**: Apply sub-agent may merge RED commits for cohesive implementations (precedent from `fiscal-period-form-ux` T-5.b and `fiscal-period-monthly-enforcement` T-4). If it does, distinguish genuinely-failing REDs from pre-existing-acceptance passes. Acceptable when implementation is cohesive.

- [x] T-2.a **(RED)** Create `components/accounting/__tests__/journal-entry-form-date-period.test.tsx`. Write JF-T01: auto-select on mount for a new entry when `date` falls within an OPEN period. Assert `periodId` Select shows the matching period. Test must fail (component has no auto-selection yet).

- [x] T-2.b **(GREEN)** In `journal-entry-form.tsx`: add `periodManuallySelected` state (`useState(false)`); add `useEffect([date, periods, periodManuallySelected])` that calls `findPeriodCoveringDate` and calls `setPeriodId`; import `findPeriodCoveringDate` from `@/features/fiscal-periods`. JF-T01 must pass.

- [x] T-3.a **(RED)** Add JF-T02 to test file: date change triggers re-select when user has not manually overridden. Test must fail.

- [x] T-3.b **(GREEN)** Verify JF-T02 passes with no new code (useEffect deps already include `date`). If not, adjust effect dependency array. All prior tests must remain green.

- [x] T-4.a **(RED)** Add JF-T03: manual Select interaction → subsequent date changes do NOT overwrite `periodId`. Test must fail.

- [x] T-4.b **(GREEN)** Wire `<Select onValueChange>` in `journal-entry-form.tsx` to call `setPeriodManuallySelected(true)` before `setPeriodId(value)`. JF-T03 must pass.

- [x] T-5.a **(RED)** Add JF-T04: when `date` is set to an uncovered value, warning banner is visible (`role="alert"`) AND submit is disabled. Test must fail.

- [x] T-5.b **(GREEN)** Add warning banner JSX below the period `<Select>` — render when `date && !periodId && periods.length > 0`. Style: reuse yellow banner from `period-create-dialog.tsx`. JF-T04 must pass.

- [x] T-6.a **(RED)** Add JF-T05: warning hidden and periodId auto-set when date changes back to a covered value. Test must fail.

- [x] T-6.b **(GREEN)** Regression — banner conditional already handles this if effect is correct. If not, fix the conditional. JF-T05 must pass.

- [x] T-7.a **(RED)** Add JF-T06: edit mode mount preserves `editEntry.periodId` (no auto-overwrite on mount). Test must fail.

- [x] T-7.b **(GREEN)** Verify dirty-flag init `false` is sufficient — effect will run but `findPeriodCoveringDate` result for `editEntry.date` within `editEntry`'s period should match and set same id. If any edge case diverges, handle. JF-T06 must pass.

- [x] T-8.a **(RED)** Add JF-T07: edit mode — user changes date → `periodId` auto-updates to covering period. Test must fail.

- [x] T-8.b **(GREEN)** Regression (same useEffect handles this path). JF-T07 must pass.

- [x] T-9.a **(RED)** Add JF-T08 + JF-T09: inclusive boundary dates (`startDate` and `endDate` of period). Tests must fail.

- [x] T-9.b **(GREEN)** Regression — string-slice comparison in helper is inclusive. JF-T08 and JF-T09 must pass.

---

## Phase 3: Verify

- [x] T-10 **(VERIFY)** Run `pnpm test`. Expected: baseline + 5 helper tests + 9 component scenarios ≈ baseline + 14. Report actual count. All must pass.
  - **Actual**: 2728 (2718 baseline + 10 component tests). All pass.

- [x] T-11 **(VERIFY)** Run `pnpm tsc --noEmit`. Must report 0 errors.
  - **Actual**: 0 errors.

- [x] T-12 **(VERIFY)** Run lint on touched files (`journal-entry-form.tsx`, `period-helpers.ts`, `index.ts`, both test files). Must report 0 errors.
  - **Actual**: 0 errors, 0 warnings.
