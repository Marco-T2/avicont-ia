# Tasks: Fiscal Period Monthly Enforcement

## Phase 0 — Check-in (CHORE)

- [x] T-0 (CHORE): Emit Phase 0 check-in report.
  - Inputs read: spec (#995), design (file), proposal (#991).
  - Invariant collision pre-scan: only "Backend MUST NOT be modified" — explicitly superseded by this change. No new collisions.
  - Retirement inventory: pure additive change — no deletions, no retirements.
  - Test baseline: 2699 (308 files). Confirmed via `pnpm test` run.

## Phase 1 — Investigate ME-T07 Ambiguity (INVESTIGATE)

- [x] T-1 (INVESTIGATE): Determine failure mode for `{startDate: "2025-02-01", endDate: "2025-02-29"}`.
  - `z.coerce.date()` uses `new Date(value)` internally. Node.js `new Date('2025-02-29')` silently rolls over to `2025-03-01T00:00:00.000Z` — confirmed empirically. Zod does NOT reject the input.
  - Service receives `endDate = 2025-03-01`, which is NOT `lastDayOfUTCMonth(startDate=2025-02-01)` = `2025-02-28`.
  - **Decision**: ME-T07 test asserts service-level rejection via `FISCAL_PERIOD_NOT_MONTHLY` (422). No Zod-level error; rollover is silent. Test input must pass `Date` objects directly (bypass string coercion): `startDate: new Date(Date.UTC(2025,1,1)), endDate: new Date(Date.UTC(2025,2,1))`.
  - No implementation change required beyond the guard already planned.
  <!-- INVESTIGATION NOTE — remove before archive:
    new Date('2025-02-29') → 2025-03-01T00:00:00.000Z (silent rollover).
    Zod z.coerce.date() does NOT reject it. Service guard catches it because
    endDate (Mar 1) ≠ lastDayOfUTCMonth(Feb 2025) = Feb 28.
    Test strategy: pass Date objects directly; assert ValidationError 422 FISCAL_PERIOD_NOT_MONTHLY.
  -->

## Phase 2 — Helper Unit Tests (lib/date-utils.ts)

- [x] T-2.a (RED): Add 5 failing unit tests to `lib/__tests__/date-utils.test.ts` — new `describe("lastDayOfUTCMonth")` block.
  - Jan 2026 → Jan 31 (`Date.UTC(2026,0,1)` → `2026-01-31`)
  - Feb 2024 leap → Feb 29 (`Date.UTC(2024,1,1)` → `2024-02-29`)
  - Feb 2026 non-leap → Feb 28 (`Date.UTC(2026,1,1)` → `2026-02-28`)
  - Apr 2026 → Apr 30 (`Date.UTC(2026,3,1)` → `2026-04-30`)
  - Dec 2026 year-rollover edge → Dec 31 (`Date.UTC(2026,11,1)` → `2026-12-31`)
  - Commit: `test: add failing unit tests for lastDayOfUTCMonth helper`

- [x] T-2.b (GREEN): Implement `export function lastDayOfUTCMonth(date: Date): Date` in `lib/date-utils.ts`.
  - Implementation: `return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));`
  - Add JSDoc explaining the day-0 wrap pattern.
  - Commit: `feat: add lastDayOfUTCMonth UTC helper`

## Phase 3 — Error Constant (CHORE)

- [x] T-3 (CHORE): Add `FISCAL_PERIOD_NOT_MONTHLY` constant to `features/shared/errors.ts`.
  - Insert after `INVALID_DATE_RANGE` in the "Períodos Fiscales" block (line ~60).
  - `export const FISCAL_PERIOD_NOT_MONTHLY = "FISCAL_PERIOD_NOT_MONTHLY";`
  - Commit: `chore: add FISCAL_PERIOD_NOT_MONTHLY error code`

## Phase 4 — Service Guard TDD Pairs

- [x] T-4.a (RED): Create `features/fiscal-periods/__tests__/fiscal-periods.service.monthly-shape.test.ts`.
  - ME-T01: `startDate=2026-01-01, endDate=2026-12-31` → `ValidationError` code `FISCAL_PERIOD_NOT_MONTHLY`, statusCode 422.
  - Use same mock pattern as `multiplicity.test.ts` (`buildRepoMock`, `baseInput`).
  - Commit: `test: add failing monthly-shape guard tests (ME-T01..ME-T08)` (all 8 tests written at once in a single RED)

- [x] T-4.b (GREEN): Implement `assertMonthlyShape(startDate, endDate)` in `fiscal-periods.service.ts`.
  - Import `lastDayOfUTCMonth` from `@/lib/date-utils`.
  - Import `FISCAL_PERIOD_NOT_MONTHLY` from `@/features/shared/errors`.
  - Call after `INVALID_DATE_RANGE` check, before `findByYearAndMonth`.
  - Throws `ValidationError("El período debe corresponder a exactamente un mes calendario.", FISCAL_PERIOD_NOT_MONTHLY)`.
  - Acceptance: REQ-5, AC-5.1..AC-5.4, ME-T01 passes.
  - Commit: `feat: add monthly-shape guard to FiscalPeriodsService.create (REQ-5, ME-T01)`

- [x] T-5.a (RED): Add ME-T02 to `fiscal-periods.service.monthly-shape.test.ts`. (included in single RED commit)
- [x] T-5.b (GREEN): ME-T02 passes — guard handles start-not-1st. (no new impl needed; covered by T-4.b GREEN)
- [x] T-6.a (RED): Add ME-T03 to `fiscal-periods.service.monthly-shape.test.ts`. (included in single RED commit)
- [x] T-6.b (GREEN): ME-T03 passes — guard handles end-not-last-day. (no new impl needed)
- [x] T-7.a (RED): Add ME-T04 to `fiscal-periods.service.monthly-shape.test.ts`. (included in single RED commit)
- [x] T-7.b (GREEN): ME-T04 passes — leap Feb 29 accepted. (no new impl needed)
- [x] T-8.a (RED): Add ME-T05 to `fiscal-periods.service.monthly-shape.test.ts`. (included in single RED commit)
- [x] T-8.b (GREEN): ME-T05 passes — non-leap 2026 Feb 28 accepted. (no new impl needed)
- [x] T-9.a (RED): Add ME-T06 to `fiscal-periods.service.monthly-shape.test.ts`. (included in single RED commit)
- [x] T-9.b (GREEN): ME-T06 passes — non-leap 2025 Feb 28 accepted. (no new impl needed)
- [x] T-10.a (RED): Add ME-T07 to `fiscal-periods.service.monthly-shape.test.ts`. (included in single RED commit)
- [x] T-10.b (GREEN): ME-T07 passes — rollover endDate (Mar 1) rejected by guard. (no new impl needed)
- [x] T-11.a (RED): Add ME-T08 to `fiscal-periods.service.monthly-shape.test.ts`. (included in single RED commit)
- [x] T-11.b (GREEN): ME-T08 passes — valid Apr 2026 period regression OK. (no new impl needed)

## Phase 5 — Regression and Final Verify

- [x] T-12 (VERIFY): Run `pnpm test`. Result: 2712 tests, 309 files — all passing. Delta +13 (5 unit + 8 service). Multiplicity suite green.

- [x] T-13 (VERIFY): Run `pnpm tsc --noEmit`. Result: 0 errors.

- [x] T-14 (VERIFY): Run `pnpm lint` on touched files. Result: 0 errors, 0 warnings.
