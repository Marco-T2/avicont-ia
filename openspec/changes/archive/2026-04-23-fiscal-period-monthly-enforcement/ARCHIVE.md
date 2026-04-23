# Archive: fiscal-period-monthly-enforcement

**Archived**: 2026-04-23
**Outcome**: PASS_WITH_WARNINGS → W-02/AC-5.6 fixed pre-archive → ARCHIVED
**Change type**: Backend hardening (service-level validation)
**Scope**: `FiscalPeriodsService.create()` — monthly-shape invariant

## Summary

This change adds a server-side guard to `FiscalPeriodsService.create()` that rejects any fiscal period whose `(startDate, endDate)` pair does not cover exactly one UTC calendar month. It closes a known enforcement gap in the schema (the DB's `@@unique([organizationId, year, month])` + `CHECK (month BETWEEN 1 AND 12)` already tracked months, but did not verify `endDate` alignment). The guard throws `FISCAL_PERIOD_NOT_MONTHLY` (422), surfaces via `AppError.details`, and is the authoritative second line of defense behind the UX warning introduced in `fiscal-period-form-ux`.

## Promoted canonical

- `openspec/specs/fiscal-period-creation-ux/spec.md` — added REQ-5 (server-side monthly-shape invariant with AC-5.1..AC-5.6 and scenarios ME-T01..ME-T09 + UX-T10); modified REQ-4 to note REQ-5 as second line of defense; removed "Backend MUST NOT be modified" constraint; added new constraints for `FISCAL_PERIOD_NOT_MONTHLY` precedence and `lastDayOfUTCMonth` correctness.

## Numbers

- 14 tasks across 5 phases (apply) + 2 post-verify fix commits (W-02 resolution)
- Tests: 2699 → **2713** (+14: 5 helper unit + 8 service ME-T + 1 details assertion)
- Typecheck: 0 errors
- Lint: 0 errors on touched files
- Invariant collisions: 0 new (one existing superseded in proposal with rationale)
- Rule triggers: 0

## Files delivered

| File | Action |
|------|--------|
| `lib/date-utils.ts` | Modified — added `lastDayOfUTCMonth(date: Date): Date` export |
| `lib/__tests__/date-utils.test.ts` | Modified — added 5-scenario unit test block for `lastDayOfUTCMonth` |
| `features/shared/errors.ts` | Modified — added `FISCAL_PERIOD_NOT_MONTHLY` constant (Períodos Fiscales block) |
| `features/fiscal-periods/fiscal-periods.service.ts` | Modified — added `assertMonthlyShape` guard, called in `create()` after `INVALID_DATE_RANGE` |
| `features/fiscal-periods/__tests__/fiscal-periods.service.monthly-shape.test.ts` | Created — ME-T01..ME-T09 service integration tests |

## Commits

- Planning artifacts: not individually committed (untracked during planning, captured as part of archive move)
- `f7c24d2` — test: add failing unit tests for lastDayOfUTCMonth helper (RED)
- `70f67fc` — feat: add lastDayOfUTCMonth UTC helper (GREEN)
- `3160023` — chore: add FISCAL_PERIOD_NOT_MONTHLY error code
- `01ebe89` — test: add failing monthly-shape guard tests (ME-T01..ME-T08) (RED)
- `49b0641` — feat: add assertMonthlyShape guard to FiscalPeriodsService.create (GREEN)
- `8c9e3f2` — test: assert AppError.details populated on monthly-shape violation (AC-5.6) (RED)
- `2c9d980` — fix: populate AppError.details in assertMonthlyShape (AC-5.6) (GREEN)
- `<archive SHA>` — chore(openspec): archive fiscal-period-monthly-enforcement

## Warnings reconciled

- **W-01** (batched RED commit for 8 ME-T cases): TDD-compliant batching — 4/8 genuinely failed (rejection cases: ME-T01, ME-T02, ME-T03, ME-T07 — guard absent at RED); 4/8 passed immediately (acceptance cases: ME-T04, ME-T05, ME-T06, ME-T08 — valid monthly shapes, service already handled them). Process note only, no behavior defect. Carry as lesson: holistic apply sometimes cannot satisfy RED independently for all cases when the state model requires a single implementation that satisfies both rejection and acceptance paths simultaneously.
- **W-02 / AC-5.6** (AppError.details gap): FIXED pre-archive. `assertMonthlyShape` was throwing `ValidationError(message, code)` with no `details` argument — details were `undefined` at runtime, no test caught it. Commits `8c9e3f2` (RED) + `2c9d980` (GREEN) fixed this. This was the **first use of `AppError.details` in the codebase** — convention established: shape is `Record<string, unknown>` with ISO strings via `.toISOString()`. Spec compliance restored before archive.

## Post-archive deliverables

- 🔲 `sdd/test-fixtures-realistic-periods` — 16+ test suites create annual-shaped `FiscalPeriod` rows directly via `prisma.fiscalPeriod.create()`, bypassing the service guard. Not a product bug today (tests are isolated) but they are prerequisites to any future Option B.3 (DB-level CHECK constraint). Track as separate backlog item.
- 🔲 Future: if a legitimate quarterly or fiscal-transition period need emerges in the Bolivian SME domain, reopen Option B.5 (PeriodGranularity enum) as the escape-hatch path. The guard as written treats ALL non-monthly shapes as invalid; the enum approach would allow controlled exceptions.
- 🔲 Future: audit query against production when a prod DB exists — template preserved in `explore.md` Section 4. The query identifies existing non-monthly rows before the guard would block their re-creation.

## Learnings

- **First use of AppError.details**: convention established — `Record<string, unknown>` with ISO strings via `.toISOString()`. JSON-safe and UI-friendly. Shape for this guard: `{ startDate: ISO, endDate: ISO }`. This serves as the template for all future `AppError` extensions that need structured error payloads beyond `message` + `code`.

- **HTTP status correction via planning-phase evidence**: the proposal initially said 400; the design sub-agent read the actual `ValidationError` constructor and the existing error-handling middleware and corrected to 422 (the constructor maps to 422 internally). Rule 5 was applied at the planning phase (design), not at verify — lower cost, higher leverage. The verify report further confirmed 422 was what the service actually returned.

- **Schema was already 80% enforced**: `@@unique([organizationId, year, month])` + `CHECK (month BETWEEN 1 AND 12)` + server-derived `month` (from `startDate.getUTCMonth() + 1`) made this a consistency close rather than new policy. The ENFORCEMENT vector existed at the schema level; the product-surface gap was only in the service layer's `endDate` alignment check. Important internal architecture documentation benefit: made the implicit explicit.

- **Recurring batched-RED pattern (N=2 cases)**: apply sub-agents tend to merge RED/GREEN when the implementation is holistic (sees a state-model that cannot be incrementally satisfied). First occurrence was T-5.b in `fiscal-period-form-ux`. Second occurrence here in ME-T01..ME-T08. Both cases involved a guard that simultaneously handles rejection and acceptance paths — writing a test that fails without the guard, and another that passes with valid input, means the GREEN commit satisfies both immediately. Not always a TDD defect; context determines whether the batching is acceptable or should be refactored into per-scenario RED commits.

- **Rule 5 N+1 empirical reinforcement**: verify independent read caught AC-5.6 gap that apply self-report was silent on. The apply sub-agent reported all tasks complete; the verify sub-agent read the actual code and found that `assertMonthlyShape` threw `ValidationError(message, code)` with no `details` argument. This is a canonical absence-detection catch — the apply sub-agent cannot easily detect what it did NOT populate. Independent verify provides asymmetric value precisely because it is stateless relative to apply. Second empirical data point confirming the Rule 5 pattern.
