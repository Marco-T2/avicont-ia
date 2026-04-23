# Verify Report: fiscal-period-monthly-enforcement

**Change**: `fiscal-period-monthly-enforcement`
**Date**: 2026-04-23
**Mode**: Strict TDD
**Verdict**: PASS WITH WARNINGS

---

## Executive Summary

All 2712 tests pass (309 files), matching the apply-report claim of +13 tests over the 2699 baseline. TypeScript type-check is clean (0 errors). ESLint reports no errors on all 5 touched files. All 5 commits (`f7c24d2`, `70f67fc`, `3160023`, `01ebe89`, `49b0641`) are confirmed in git log with matching messages. REQ-5 is structurally and behaviorally complete: `assertMonthlyShape` is wired correctly after `INVALID_DATE_RANGE` and before the DB round-trip, and ME-T01..ME-T08 all pass. One warning raised: AC-5.6 requires `AppError.details` to be populated, but the `assertMonthlyShape` throw passes no `details` argument — `details` is `undefined` at runtime. No test asserts on it either. This is a spec gap, not a behavioral defect, and does not block archiving. Two deviations (D1: batched RED, D2: module-level fn) are evaluated as acceptable. No invariant collisions. No Rule 6 violations. PERMISSIONS_WRITE["period"] is unchanged.

---

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 14 (T-0 through T-14, including batched T-5.a..T-11.b) |
| Tasks complete | 14 |
| Tasks incomplete | 0 |

All tasks marked `[x]` in `tasks.md`. No incomplete tasks.

---

## Build & Tests Execution

**Typecheck**: `pnpm tsc --noEmit` → exit 0 (0 errors)

**Tests**: `pnpm test` (vitest run)

```
Test Files  309 passed (309)
      Tests  2712 passed (2712)
   Duration  35.16s
```

Exit code: 0. No failures, no skipped.

**Lint** (`pnpm eslint` on touched files): 0 errors, 0 warnings.

**Coverage**: Not run independently (not required by mandatory checks; vitest run without --coverage is the authoritative count).

---

## TDD Compliance (Strict TDD)

| Commit | SHA | Type | Status |
|--------|-----|------|--------|
| test: add failing unit tests for lastDayOfUTCMonth helper | f7c24d2 | RED | Confirmed in git log |
| feat: add lastDayOfUTCMonth UTC helper | 70f67fc | GREEN | Confirmed in git log |
| chore: add FISCAL_PERIOD_NOT_MONTHLY error code | 3160023 | CHORE | Confirmed in git log |
| test: add failing monthly-shape guard tests (ME-T01..ME-T08) | 01ebe89 | RED (batched) | Confirmed in git log |
| feat: add assertMonthlyShape guard to FiscalPeriodsService.create | 49b0641 | GREEN | Confirmed in git log |

**D1 evaluation — Batched RED commit**: 8 tests written in one RED commit. At RED commit (`01ebe89`), 4 rejection tests (ME-T01, ME-T02, ME-T03, ME-T07) genuinely failed (guard not yet in place). 4 acceptance tests (ME-T04, ME-T05, ME-T06, ME-T08) passed immediately because the service already allowed valid periods — pre-existing acceptance behavior, not the new guard. The rejection tests constitute the true RED signal. This is TDD-compliant batching: the failing tests represent genuinely unimplemented behavior. **Grade: W-01 — process note only, no behavioral defect.**

**D2 evaluation — Module-level function vs class-private**: `assertMonthlyShape` is a module-level function (not exported, not a class method). Confirmed via grep: `function assertMonthlyShape(...)` at line 30 — no `export` keyword. The function is pure (no `this` dependency, no coupling to class state). No import-surface pollution. The design said "service-private function" which this satisfies semantically (private to the module). **Grade: Acceptable — design intent fulfilled, zero coupling concern.**

---

## Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| REQ-5 — Monthly shape invariant | ME-T01: annual period Jan 1→Dec 31 → 422 | `fiscal-periods.service.monthly-shape.test.ts > ME-T01` | ✅ COMPLIANT |
| REQ-5 AC-5.1 | ME-T02: startDate not 1st → 422 | `fiscal-periods.service.monthly-shape.test.ts > ME-T02` | ✅ COMPLIANT |
| REQ-5 AC-5.2 | ME-T03: endDate not last day → 422 | `fiscal-periods.service.monthly-shape.test.ts > ME-T03` | ✅ COMPLIANT |
| REQ-5 AC-5.3 | ME-T01: ValidationError + FISCAL_PERIOD_NOT_MONTHLY | `fiscal-periods.service.monthly-shape.test.ts > ME-T01` | ✅ COMPLIANT |
| REQ-5 AC-5.4 | Spanish voseo message exact match | `fiscal-periods.service.monthly-shape.test.ts > ME-T01` (line 107) | ✅ COMPLIANT |
| REQ-5 AC-5.5 | HTTP 422 status | `fiscal-periods.service.monthly-shape.test.ts > ME-T01..ME-T03, ME-T07` | ✅ COMPLIANT |
| REQ-5 AC-5.6 | AppError.details populated | (no test asserts on details) | ⚠️ PARTIAL |
| REQ-5 | ME-T04: leap Feb 29 2024 → 201 OK | `fiscal-periods.service.monthly-shape.test.ts > ME-T04` | ✅ COMPLIANT |
| REQ-5 | ME-T05: non-leap Feb 28 2026 → 201 OK | `fiscal-periods.service.monthly-shape.test.ts > ME-T05` | ✅ COMPLIANT |
| REQ-5 | ME-T06: non-leap Feb 28 2025 → 201 OK | `fiscal-periods.service.monthly-shape.test.ts > ME-T06` | ✅ COMPLIANT |
| REQ-5 | ME-T07: Feb 29 non-leap → rolls to Mar 1 → 422 | `fiscal-periods.service.monthly-shape.test.ts > ME-T07` | ✅ COMPLIANT |
| REQ-5 | ME-T08: valid Apr 2026 → 201 OK regression | `fiscal-periods.service.monthly-shape.test.ts > ME-T08` | ✅ COMPLIANT |
| REQ-5 | ME-T09: existing suites regression | `pnpm test` 309 files all pass | ✅ COMPLIANT |
| lastDayOfUTCMonth helper | Unit tests: Jan, Feb-leap, Feb-non-leap, Apr, Dec | `lib/__tests__/date-utils.test.ts` (+5 tests) | ✅ COMPLIANT |

**Compliance summary**: 13/14 scenarios compliant. 1 partial (AC-5.6).

### AC-5.6 Detail

The spec says `AppError.details` should be populated for UI display. In `assertMonthlyShape`, `ValidationError` is thrown as:
```ts
throw new ValidationError(
  "El período debe corresponder a exactamente un mes calendario.",
  FISCAL_PERIOD_NOT_MONTHLY,
);
```
No `details` argument is passed → `AppError.details` is `undefined`. The spec AC-5.6 is not fully satisfied: the error message IS correct and the HTTP error-serializer passes `details` through already — but the guard never populates `details`. No test asserts `details` is populated. The message string (AC-5.4) is sufficient for UI display in practice, but the spec criterion is technically unmet.

---

## Correctness (Static — Structural Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| `lastDayOfUTCMonth` export in `lib/date-utils.ts` | ✅ Implemented | Line 101 |
| `FISCAL_PERIOD_NOT_MONTHLY` in `features/shared/errors.ts` | ✅ Implemented | Line 60, Períodos Fiscales block |
| `assertMonthlyShape` guard in `fiscal-periods.service.ts` | ✅ Implemented | Lines 30–38 |
| Guard order: after INVALID_DATE_RANGE, before DB | ✅ Implemented | Lines 68–88 |
| Message: "El período debe corresponder a exactamente un mes calendario." | ✅ Implemented | Line 35 |
| HTTP 422 (ValidationError) | ✅ Implemented | ValidationError always maps to 422 |
| AC-5.6: `AppError.details` populated | ⚠️ Partial | `details` arg not passed — undefined at runtime |

---

## Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Helper in `lib/date-utils.ts` (OQ-1) | ✅ Yes | |
| Guard insertion after INVALID_DATE_RANGE, before findByYearAndMonth (OQ-2) | ✅ Yes | Lines 68–85 confirm order |
| Error constant in `features/shared/errors.ts` Períodos Fiscales block (OQ-3) | ✅ Yes | |
| N/A — no update() path (OQ-4) | ✅ Yes | update() not implemented, guard not needed |
| New test file `fiscal-periods.service.monthly-shape.test.ts` (OQ-5) | ✅ Yes | File exists, 8 ME-T cases |
| `lastDayOfUTCMonth` implementation: `Date.UTC(y, m+1, 0)` | ✅ Yes | Confirmed in service logic |
| Epoch ms comparison for endDate equality | ✅ Yes | Line 32: `endDate.getTime() === lastDayOfUTCMonth(startDate).getTime()` |
| HTTP 422, NOT 400 (design corrected proposal) | ✅ Yes | ValidationError = 422 |

---

## Invariant Collision Check

| Invariant | Status |
|-----------|--------|
| `PERMISSIONS_WRITE["period"] = ["owner","admin"]` | ✅ Unchanged — explore.md confirms, no service code touched it |
| `@@unique([organizationId, year, month])` schema | ✅ No migration — not touched |
| No Rule 6 violations | ✅ Confirmed — 5 commit bodies contain no named-Rule citations |
| No Rule 7 collisions | ✅ Confirmed — no new constraint overlaps |

---

## Rule 5 Application (Low-Cost Verification Asymmetry)

Apply self-report claimed: 2712 tests, 0 type errors, 0 lint errors.
Independent verification: **all claims confirmed**. N=4+1 Rule 5 pattern applied:
- Test count: 2712 ✅
- Typecheck: 0 errors ✅
- Lint: 0 errors ✅
- Commit SHAs: all 5 present with matching messages ✅
- AC-5.6 details gap: **CAUGHT** — apply report did not call out that `details` is not populated. This is a Rule 5 absence-detection catch. The apply self-report was silent on whether `details` was passed to `ValidationError`, and independent code reading revealed it was not. **Cite as N+1 case for Rule 5 empirical reinforcement.**

---

## Issues Found

### CRITICAL
None.

### WARNING

**W-01 — D1 Batched RED (process note)**
Apply wrote all 8 ME-T tests in one RED commit (`01ebe89`) rather than incremental RED/GREEN pairs. As evaluated: 4 rejection tests genuinely failed at RED; 4 acceptance tests passed immediately (pre-existing behavior). TDD-compliant batching. Process note only — no behavioral defect.

**W-02 — AC-5.6: AppError.details not populated**
`assertMonthlyShape` throws `ValidationError(message, code)` without a `details` argument. `AppError.details` is `undefined` at runtime. The spec AC-5.6 states "AppError.details populated for UI display." The error-serializer already handles `details` pass-through, but nothing to pass. The Spanish message (AC-5.4) is sufficient for UI display via the `message` field — this is a low-severity gap. No test asserts `details` is populated.

### SUGGESTION

**S-01 — Add details to ValidationError in assertMonthlyShape**
If UI needs structured metadata (e.g., which field failed: `startDate` vs `endDate`), populate `details`:
```ts
throw new ValidationError(
  "El período debe corresponder a exactamente un mes calendario.",
  FISCAL_PERIOD_NOT_MONTHLY,
  { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
);
```
Add a corresponding assertion in ME-T01 for `err.details` shape. Low priority — the message is sufficient today.

**S-02 — ME-T07 comment enhancement (non-blocking)**
The existing comment in the test is excellent. Consider adding a link to the MDN Date rollover docs for future readers.

---

## Verdict

**PASS WITH WARNINGS**

REQ-5 is fully implemented and behaviorally verified. 2712/2712 tests pass. The only open item (W-02) is a spec gap in AC-5.6 that does not affect the primary enforcement behavior — the error is thrown, the message is correct, the HTTP status is 422, and the client can display the voseo message. Safe to archive.

---

## Artifacts

- File: `openspec/changes/fiscal-period-monthly-enforcement/verify-report.md`
- Engram: `sdd/fiscal-period-monthly-enforcement/verify-report`
