# Proposal: Journal Form — Date-Aware Period Auto-Selection

**Change**: `journal-form-date-aware-period`
**Date**: 2026-04-23
**Status**: DRAFT

## Intent

Eliminate silent period misassignment in journal entries. Today, `journal-entry-form.tsx` defaults `periodId` to the first OPEN period in the array, regardless of the voucher `date`. A user can submit a voucher dated 2026-03-15 with `periodId = "Abril 2026"` — the form neither warns nor blocks. IVA books, monthly reports, and regulatory filings are silently corrupted.

The fix: add a `useEffect([date, periods])` that auto-selects the period whose `startDate ≤ date ≤ endDate AND status === "OPEN"`. A dirty-flag pattern prevents auto-overwrite after the user explicitly overrides.

**Why now**: Adjacent to `fiscal-period-monthly-enforcement` (shipped 2026-04-23), which guarantees at most one OPEN period can cover any given date. No ambiguity possible from here.

## Scope

### In Scope
- `components/accounting/journal-entry-form.tsx` — auto-select logic + warning banner + dirty flag
- `features/fiscal-periods/period-helpers.ts` — new `findPeriodCoveringDate()` pure helper
- Unit tests for the helper; RTL component tests for JF-T01..JF-T07

### Out of Scope
- **`create-journal-entry-form.tsx`** — this form has NO `periods` prop, NO `periodId` field, and uses a completely different shape (hardcoded `voucherType` enum, no FiscalPeriod concept). The problem does not exist there. OUT OF SCOPE.
- **Server-side date-boundary validation** in `journal.service.ts` — service validates `period.status === "OPEN"` only; it does NOT check `entry.date ∈ [period.startDate, period.endDate]`. Flagged as backlog: `sdd/journal-service-period-boundary-check`.
- Schema changes, API changes, route handlers.

## Capabilities

### New Capabilities
- `journal-entry-form-ux`: Client-side UX behavior for `JournalEntryForm` — period auto-selection, dirty-flag manual override, no-match warning, and submit guard.

### Modified Capabilities
- None (no existing canonical spec covers `journal-entry-form.tsx` UX).

## Approach

1. **`findPeriodCoveringDate(date, periods)`** — pure function, feature-local at `features/fiscal-periods/period-helpers.ts`. Returns the single OPEN period where `startDate ≤ date ≤ endDate`, or `null`. Monthly-shape invariant guarantees at most one match.
2. **Dirty-flag**: `periodManuallySelected: boolean` state. Flips to `true` on `<Select onValueChange={setPeriodId}>` user interaction. Cleared only on `resetForm()` (new entries don't reset; edit mode: stays false on mount).
3. **`useEffect([date, periods])`**: if `!periodManuallySelected && date`, call `findPeriodCoveringDate`; if found → `setPeriodId(match.id)`; if not found → `setPeriodId("")`.
4. **Warning UI**: inline banner (role="alert") below the period field when `date` set and no period matches. Spanish voseo.
5. **Submit guard**: existing `canSubmit` already requires `periodId` truthy (line 165). When no match → `setPeriodId("")` → `canSubmit = false` automatically.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `components/accounting/journal-entry-form.tsx` | Modified | Add dirty-flag state, useEffect, warning banner |
| `features/fiscal-periods/period-helpers.ts` | New | `findPeriodCoveringDate` pure helper |
| `features/fiscal-periods/__tests__/period-helpers.test.ts` | New | Unit tests for helper |
| `components/accounting/__tests__/journal-entry-form-date-period.test.tsx` | New | RTL tests JF-T01..JF-T07 |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Dates stored as UTC-midnight shift 1 day in BO timezone (UTC-4) | Med | Use `date.slice(0,10)` string comparison against `startDate.toISOString().slice(0,10)` — no Date construction, no TZ shift |
| Edit mode regression: auto-select overwrites `editEntry.periodId` on mount | Low | `editEntry?.periodId` initializes flag path; see OQ-4 resolution in design |
| FiscalPeriod.endDate stored at UTC-noon (from `toNoonUtc`) vs date input "YYYY-MM-DD" | Low | String-slice comparison avoids all TZ math entirely |

## Rollback Plan

Revert `journal-entry-form.tsx` changes and delete `period-helpers.ts`. No DB migrations, no API changes. Single-file + helper revert.

## Dependencies

- `fiscal-period-monthly-enforcement` SHIPPED (2026-04-23, commit `f85f289`) — guarantees at-most-one OPEN period per date. Required for the logic to be unambiguous.

## Open Questions Forwarded

- **OQ-1** (warning wording): Forwarded to spec. Voseo Spanish. Proposed: `"La fecha {date} no está cubierta por ningún período abierto. Verificá el período antes de guardar."`
- **OQ-2** (warning timing): Forwarded to spec. Recommend pre-submit (on date change), not only on submit attempt.
- **OQ-3** (second form file): **RESOLVED** — `create-journal-entry-form.tsx` has no `periods` prop. OUT OF SCOPE.
- **OQ-4** (edit mode semantics): Forwarded to design. Recommendation: on mount, start with dirty-flag = `false` so `useEffect` still runs once; if `editEntry.periodId` is the correct match → no visible change. On subsequent date changes: re-select unless user manually overrides.

## Success Criteria

- [ ] Submitting a voucher dated 2026-03-15 with form defaulting to "Abril 2026" is impossible: auto-selection corrects to "Marzo 2026" if OPEN, or warns if no OPEN period covers the date.
- [ ] Manual override of `periodId` by the user persists through subsequent `date` changes.
- [ ] Warning banner appears (role="alert") when date falls outside all OPEN periods.
- [ ] Submit button is disabled (canSubmit = false) when no period covers the date.
- [ ] All 7 JF-T scenarios pass. Existing tests remain green.
- [ ] Server-side backlog item recorded: `sdd/journal-service-period-boundary-check`.
