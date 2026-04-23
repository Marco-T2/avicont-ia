# Archive: journal-form-date-aware-period

**Archived**: 2026-04-23
**Outcome**: PASS_WITH_WARNINGS → W-01 resolved via spec cleanup → ARCHIVED
**Change type**: UX / form behavior (client-only)
**Scope**: `components/accounting/journal-entry-form.tsx`

## Summary
Client-only change that auto-selects `periodId` in journal-entry-form based on voucher date, with manual-override protection via dirty-flag pattern. Establishes first TZ-safe date comparison in the project using `.toISOString().slice(0,10)` string-slice pattern. Resolves last silent-misassignment failure mode for vouchers.

## Promoted canonical
- `openspec/specs/journal-entry-form-ux/spec.md` — NEW capability (3 REQs, 9 scenarios JF-T01..JF-T09, AC-1.4 omitted)

## Spec cleanup at promotion
- **AC-1.4 dropped**: "form reset clears dirty-flag" described behavior with no implementation surface. The form has no reset handler (`grep -n 'reset\|Reset\|onReset\|form.reset' components/accounting/journal-entry-form.tsx` → zero matches). Removed to keep canonical spec and code in honest alignment. If a reset action is added later, reopen the dirty-flag contract explicitly.

## Numbers
- Planning: 4 artifacts (sdd-ff Level 1 compression)
- Apply: 6 commits (2 helper RED/GREEN, 2 component RED/GREEN, 1 chore lint, 1 chore tasks.md)
- Tests: 2713 → **2728** (+15)
- Typecheck: 0 errors
- Lint: 0 errors on touched files

## Files delivered
| File | Action |
|------|--------|
| `features/fiscal-periods/period-helpers.ts` | Created — `findPeriodCoveringDate` TZ-safe helper |
| `features/fiscal-periods/__tests__/period-helpers.test.ts` | Created — 5 unit tests |
| `features/fiscal-periods/index.ts` | Modified — re-export |
| `components/accounting/journal-entry-form.tsx` | Modified — dirty-flag, useEffect, onValueChange, warning banner |
| `components/accounting/__tests__/journal-entry-form-date-period.test.tsx` | Created — JF-T01..JF-T09 |

## Commits
- `ac56271` — RED helper unit tests
- `354a09c` — GREEN findPeriodCoveringDate
- `bd26c1d` — RED component scenarios (batched; 4/9 genuinely failed)
- `599f9e5` — GREEN component wiring
- `b5c40bd` — chore lint cleanup
- `434ec63` — chore tasks.md progress
- `<archive SHA>` — chore(openspec): archive journal-form-date-aware-period

## Warnings reconciled
- **W-01** (AC-1.4 reset gap): RESOLVED via spec cleanup at canonical promotion. AC-1.4 dropped; no code change. Rationale: reset handler doesn't exist.
- Banner placement (full-width vs grid cell): ACCEPTABLE deviation, all assertions use `role="alert"` (position-agnostic).
- Batched RED (N=3 pattern): TDD-compliant with distinction between genuinely-failing (4) and pre-existing-acceptance (5).

## Observations
- **OBS-01**: JF-T06 passes because `editEntry.date` is internally consistent with `editEntry.periodId`. Inconsistent data would cause silent overwrite — not a spec violation.
- **OBS-02**: Batched-RED pattern N=3 in project. Consider codifying as convention in tasks template.

## Post-archive deliverables
- 🔲 `sdd/journal-service-period-boundary-check` — server-side validation that voucher.date falls within periodId's range. Current fix is client-only.
- 🔲 If reset action ever added to journal-entry-form: wire `setPeriodManuallySelected(false)` to honor AC-1.4 intent.
- 🔲 `sdd/rbac/seed-reconciliation-gap` — carry-over from prior cycles.

## Learnings

### 1. TZ-safe date comparison pattern (first in project)
Bolivia UTC-4. Pattern: `date.toISOString().slice(0,10)` string-comparison on both bounds avoids `new Date("YYYY-MM-DD")` TZ-shift bugs. Saved as `pattern/tz-safe-date-comparison` in engram.

### 2. Rule 5 N+1 — verify catches spec-code divergence
Verify caught AC-1.4 describing behavior with no code surface. Apply silent. Resolution via spec cleanup (cheaper than code fix when AC was aspirational). Another empirical case for `feedback_low_cost_verification_asymmetry.md`.

### 3. Batched-RED TDD compliance (N=3 canonical pattern)
Third occurrence. Pattern: cohesive state models (single useEffect + single banner + single flag) don't benefit from per-scenario RED/GREEN split. Acceptable when apply report distinguishes genuinely-failing from pre-existing-acceptance.

### 4. Fast-forward planning (sdd-ff Level 1) — sub-agents tend to stop
First sub-agent stopped after proposal, handed back to orchestrator. Second sub-agent completed spec/design/tasks. Lesson: emphasize "do NOT return until all phases complete" or split at natural boundary (proposal vs spec+design+tasks).
