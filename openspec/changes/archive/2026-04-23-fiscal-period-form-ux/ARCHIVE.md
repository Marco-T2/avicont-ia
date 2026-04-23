# Archive: fiscal-period-form-ux

**Archived**: 2026-04-23
**Outcome**: PASS_WITH_WARNINGS (warnings reconciled pre-archive) → ARCHIVED
**Change type**: UX enhancement
**Scope**: Period creation dialog (`components/accounting/period-create-dialog.tsx`)

## Summary

This change fixed the UX gap in `PeriodCreateDialog` that systematically guided users into creating one annual fiscal period instead of 12 monthly ones. The placeholder `"Ej: Gestión 2026"` was replaced with `"Ej: Abril 2026"`, a month `<Select>` with date/name autocomplete was added, a soft cross-month warning was introduced, and a batch "Crear los 12 meses del año" shortcut was delivered — all without any backend, schema, or permission changes. The fiscal-period-creation-ux capability was formally established as a new canonical spec (no prior canonical existed for this surface).

## Promoted canonical

- `openspec/specs/fiscal-period-creation-ux/spec.md` (new capability, 4 REQs, 8 UX scenarios UX-T01..UX-T08)

## Numbers

- 22 tasks across 6 phases (apply) + 3 post-verify fix commits
- Test baseline 2681 → 2699 (+18: 16 UX scenarios + S-01 non-FPE-code test + S-02 coverage)
- Typecheck: 0 errors
- Lint: 0 errors on touched files (134 pre-existing elsewhere — out of scope)
- 0 invariant collisions, 0 Rule triggers

## Files delivered

| File | Action | Notes |
|------|--------|-------|
| `features/fiscal-periods/month-names.ts` | CREATE | Exports `MONTH_NAMES_ES` (12 entries, `as const`) and `MonthNameEs` type; no `"server-only"` import; isomorphic |
| `features/fiscal-periods/fiscal-periods.service.ts` | MODIFY | Replaced local `const MONTH_NAMES_ES` with import from `./month-names` |
| `features/fiscal-periods/index.ts` | MODIFY | Added `export { MONTH_NAMES_ES } from "./month-names"` |
| `components/accounting/period-create-dialog.tsx` | MODIFY | Placeholder → `"Ej: Abril 2026"`, microcopia, month `<Select>`, date/name autocomplete, dirty-flag manual override, cross-month warning, batch handler `handleBatch()`, year validation |
| `components/accounting/__tests__/period-create-dialog.test.tsx` | CREATE | 19 tests (16 UX scenarios + S-01 body-parse test + S-02 empty-fields warning-absence coverage) |

## Warnings reconciled

- **W-01** — T-5.b scope merge (process, no behavior defect): commit `fd368c0` bundled GREEN code for T-5.b through T-11.b; subsequent RED commits (T-6.a through T-11.a) landed against already-green code, meaning those RED tests never exhibited the failing state relative to the codebase at the time they were committed. Audit-trail issue only — all behaviors are correct, all tests pass. Not rewritten — carry as lesson.

## Suggestions resolved pre-archive

- **S-01** — `handleBatch` now parses the 409 response body `code` field before classifying the response as "ya existía". Previously all 409s were unconditionally counted as `FISCAL_PERIOD_MONTH_EXISTS`. Real API shape discovered as flat `{error: string, code: string}`, not nested. The pre-existing UX-T08 mock was also corrected in the GREEN commit to use the flat shape. Commits: `74e5202` (RED — test for 409 with non-FISCAL_PERIOD_MONTH_EXISTS code) + `6ae2a8d` (GREEN — body parsing fix).
- **S-02** — Added explicit coverage test for the "warning absent when fields are empty" initial state (behavior was already correct per REQ-4 — `crossMonthWarning` returns `false` when `!startDate || !endDate`). Commit: `81a6287`.

## Post-archive deliverables

- **Enforcement estructural de granularidad mensual** (`sdd/fiscal-period-monthly-enforcement`): adding a schema constraint that enforces `startDate.day === 1` AND `endDate === lastDayOf(startDate.month)` was explicitly out of scope by user decision (2026-04-22). Reopen if a second empirical incident occurs with an advanced user who bypasses the UX guidance.
- **RBAC seed reconciliation gap** (`sdd/rbac/seed-reconciliation-gap`): `prisma/seed-system-roles.ts` uses `skipDuplicates: true` and does not reconcile changes to the permissions matrix. Backlogged — out of scope for this change.
- **Date-aware `periodId` default in journal-entry-form** (`sdd/journal-form/date-aware-period`): the voucher creation form does not preselect the period matching the voucher date. Backlogged — out of scope.
- **Migración retroactiva de orgs con período anual**: organizations that already created a single annual period (as in the empirical E2E session that triggered this change) are not automatically migrated. Operational decision, not architectural.

## Learnings

### 1. Aspirational mocks must match real API shape (Rule 4 territory)

UX-T08's original mock used a nested `{error: {code: "FISCAL_PERIOD_MONTH_EXISTS"}}` shape that was never validated against the actual API response. The real API returns a flat `{error: string, code: string}`. The test passed during apply because the component's handler also used the same wrong shape consistently — the mock and the code were wrong together. S-01 surfaced this during verify. Pattern: when a test mocks an external API response, ALWAYS verify the mock shape against the actual endpoint (either via curl or by reading the route handler's error serialization). A test that is "too easy to make green" by mirroring the implementation's assumption is not testing the integration boundary — it is testing that the implementation is internally consistent with its own fiction.

### 2. T-5.b scope merge: single-GREEN-many-REDs anti-pattern for tightly-coupled state

When multiple behaviors share a single state slice (here: `selectedMonth`, the `useEffect`, `manualStartDate`/`manualEndDate`/`manualName` dirty flags, `crossMonthWarning`, `handleBatch`, `isYearValid`), implementing them in a single commit is tempting because they are entangled. The result here was commit `fd368c0` containing 6 tasks' worth of GREEN code, with the RED tests for T-6 through T-11 committed after the fact. The audit trail is inverted — verify can confirm this but cannot unwind it. Mitigation: when state is shared, decompose GREEN commits at the state boundary (e.g., add state + one consumer behavior per commit), not at the task boundary. Accept the higher commit density as the cost of a clean RED→GREEN trail.

### 3. UX-sourced bugs surface later than code bugs (temporal trap)

The root cause of this change was a UX text issue (`placeholder="Ej: Gestión 2026"`) introduced at dialog creation time that remained latent until the user's first close attempt — potentially days or weeks after setup. Code bugs surface at test or runtime. UX bugs that misguide data entry surface at the moment the user tries to use the data they misentered. This temporal gap makes UX bugs particularly expensive: the confusion is baked in at creation and only revealed at harvest. Design principle: treat UX copy that guides data entry with the same care as schema constraints — they are effectively soft constraints on the data model.

### 4. Rule 5 negative-result evidence: empirical E2E caught a UX bug, not a code bug

The Rule 5 (low-cost verification asymmetry) empirical session on 2026-04-22 confirmed that the fiscal period monthly-close motor was correct end-to-end. Crucially, it ALSO revealed that the failure mode was entirely in the UX onboarding surface — a finding that no architectural review or static analysis would have surfaced. This is a positive example of Rule 5 yielding a "negative result" (the system works) that is nonetheless actionable (the UX doesn't). Record as evidence that Rule 5 sessions should be run even when the system is believed to be correct — the value is in discovering what the system is correct about, which implicitly surfaces what it is not.
