# Proposal: fiscal-period-monthly-enforcement

## Intent

Close the 20% schema gap left after `fiscal-period-form-ux`: the DB already enforces `@@unique([organizationId, year, month])` and `CHECK (month BETWEEN 1 AND 12)`, but nothing prevents `endDate` from spanning multiple months. A service-level guard in `FiscalPeriodsService.create()` that rejects shapes where `startDate.day ≠ 1` OR `endDate ≠ lastDayOfUTCMonth(startDate)` closes this path permanently — no migration, no existing-data impact, ~1 h of work.

## Scope

### In Scope

- Guard in `features/fiscal-periods/fiscal-periods.service.ts` → `create()`, between `INVALID_DATE_RANGE` check and month uniqueness pre-check
- New error constant `FISCAL_PERIOD_NOT_MONTHLY` in `features/shared/errors.ts`
- Spanish-voseo user message: `"El período debe corresponder a exactamente un mes calendario."`
- Delta to `openspec/specs/fiscal-period-creation-ux/spec.md` — supersede "Backend MUST NOT be modified" constraint; update REQ-4 (soft warning now redundant — server rejects)

### Out of Scope

| Item | Rationale |
|------|-----------|
| B.3 — DB-level `@@check` constraint | 16+ test suites create annual-period fixtures via raw Prisma; prerequisite cleanup tracked as `sdd/test-fixtures-realistic-periods` |
| B.4 — drop `startDate`/`endDate` | Breaks 8+ consumers; very low reversibility |
| B.5 — `PeriodGranularity` enum | No confirmed non-monthly product requirement |
| Migration of existing non-monthly rows | Dev DB is disposable; no prod exists; revisit when prod appears |
| Cleanup of 16 annual-period test fixtures | Blocked by B.3; separate backlog item |

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `fiscal-period-creation-ux`: supersede "Backend MUST NOT be modified" constraint; REQ-4 soft warning becomes second line of defense (server rejects first)

## Approach

**Option B.2 — service-level guard** (recommended in explore phase, confirmed here).

In `FiscalPeriodsService.create()`:
1. Check `startDate.getUTCDate() === 1`
2. Check `endDate` equals `lastDayOfUTCMonth(startDate)`
3. On violation: throw `ValidationError(FISCAL_PERIOD_NOT_MONTHLY, "El período debe corresponder a exactamente un mes calendario.")`

Guard runs BEFORE the month uniqueness pre-check (OQ-2 for design to resolve: error-code precedence). `AppError.details` passthrough is already implemented (`apperror-details-passthrough` change) — error surfaces at 400 in the UI automatically.

Pattern precedent: `INVALID_DATE_RANGE` guard already lives in `fiscal-periods.service.ts` at line 42 — B.2 is a canonical extension of that pattern.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `features/fiscal-periods/fiscal-periods.service.ts` | Modified | Add monthly-shape guard in `create()` |
| `features/shared/errors.ts` | Modified | Add `FISCAL_PERIOD_NOT_MONTHLY` constant |
| `openspec/specs/fiscal-period-creation-ux/spec.md` | Modified | Supersede backend constraint; update REQ-4 note |
| `features/fiscal-periods/month-helpers.ts` (new, TBD) | New (design decision) | `lastDayOfUTCMonth()` helper — placement TBD in design phase |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Quarterly / bridging periods rejected | Low — no known non-monthly use case in Bolivian SME | Documented escape hatch: remove guard if quarterly periods ever required |
| Leap-year edge (Feb 29) | Low — helper must handle it | Unit-test `lastDayOfUTCMonth` for leap and non-leap years explicitly |
| Error message not reaching UI | Low — `AppError.details` passthrough verified in `apperror-details-passthrough` | AC-6 covers end-to-end error surfacing |
| Guard position vs. uniqueness pre-check (OQ-2) | Low | Design phase resolves error-code precedence |

## Rollback Plan

Remove the monthly-shape guard block from `fiscal-periods.service.ts` and the `FISCAL_PERIOD_NOT_MONTHLY` constant from `errors.ts`. No migration needed. Revert in a single commit. Existing data unaffected.

## Dependencies

- `apperror-details-passthrough` (archived) — `AppError.details` passthrough is live; this change depends on it for error surfacing
- `openspec/specs/fiscal-period-creation-ux/spec.md` — must be updated (delta spec in this change)

## Success Criteria

- [ ] AC-1: POST `{startDate: 2026-01-01, endDate: 2026-12-31}` → 400 with code `FISCAL_PERIOD_NOT_MONTHLY`
- [ ] AC-2: POST `{startDate: 2026-02-01, endDate: 2026-02-29}` (leap year) → 201
- [ ] AC-3: POST `{startDate: 2026-02-01, endDate: 2026-02-28}` (leap year, wrong end) → 400
- [ ] AC-4: POST with valid monthly shape → 201, no regression
- [ ] AC-5: All existing `fiscal-periods.service.*.test.ts` suites pass — guard is additive
- [ ] AC-6: Client error UX shows Spanish-voseo message; no stack trace leaked

---

## Rule 7 Collision Scan

| Item | Outcome |
|------|---------|
| `fiscal-period-creation-ux` spec constraint "Backend MUST NOT be modified" | **EXPLICIT COLLISION — SUPERSEDED**. That constraint was a scoping decision for Option A, not an architectural invariant. This proposal supersedes it with documented rationale. |
| `PERMISSIONS_WRITE["period"] = ["owner","admin"]` | No collision — unchanged |
| `@@unique([organizationId, year, month])` | Aligned — B.2 strengthens the existing derivation invariant |
| No enum changes | No collision |

---

## Open Questions → Forwarded to spec/design

| # | Question |
|---|---------|
| OQ-1 | `lastDayOfUTCMonth()` helper placement: `features/fiscal-periods/month-helpers.ts` (new) vs. inline vs. extend `month-names.ts` |
| OQ-2 | Guard position vs. month uniqueness pre-check — which error fires first when both conditions are violated? |
| OQ-3 | `FISCAL_PERIOD_NOT_MONTHLY` location: `features/shared/errors.ts` (project pattern) or feature-local |
| OQ-4 | Does guard apply to `update()` if it exists, or `create()` only? |
| OQ-5 | Test strategy: unit test on `lastDayOfUTCMonth()` pure function + integration test on service boundary — which files, which suites |
