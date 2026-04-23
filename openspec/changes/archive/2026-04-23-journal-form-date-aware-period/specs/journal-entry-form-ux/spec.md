# journal-entry-form-ux Specification

**Change**: `journal-form-date-aware-period`
**Capability**: `journal-entry-form-ux` (NEW — no prior canonical spec)
**Date**: 2026-04-23
**Type**: Full new capability spec

## Purpose

Specifies client-side UX behavior for `JournalEntryForm` — date-aware period auto-selection, dirty-flag manual override, no-match warning banner, and submit guard. Backend is unchanged.

User-facing strings follow **voseo Rioplatense** Spanish.

---

## Requirements

### REQ-1: Date-Aware Period Auto-Selection

The form MUST auto-set `periodId` to the unique OPEN period where `startDate ≤ date ≤ endDate`. If no period matches, `periodId` MUST be set to empty.

Auto-selection MUST re-run on every `date` change UNLESS the user has manually overridden the period selector since the last form reset.

Once the user manually interacts with the period `<Select>`, subsequent `date` changes MUST NOT overwrite `periodId`. On form reset, the dirty-flag MUST clear and auto-selection resumes.

In edit mode (`editEntry` provided), auto-selection MUST run on `date` change unless the user has manually changed the period since form mount. The `editEntry.periodId` is not treated as a manual override — it does not set the dirty-flag on mount.

#### Scenario JF-T01 — Auto-select on mount, new entry

- GIVEN the form opens for a new entry with `date` = today (within an OPEN period)
- WHEN the component mounts
- THEN `periodId` equals the matching OPEN period's `id`

#### Scenario JF-T02 — Date change re-selects period

- GIVEN `periodId` was auto-selected for month A
- WHEN the user changes `date` to a value covered by a different OPEN period B
- THEN `periodId` updates to period B's `id`

#### Scenario JF-T03 — Manual override wins on date change

- GIVEN the user manually selected `periodId = X` via the period `<Select>`
- WHEN the user changes `date` to a range that would auto-select a different period Y
- THEN `periodId` remains X

#### Scenario JF-T06 — Edit mode mount preserves editEntry.periodId

- GIVEN `editEntry.periodId = X` is provided
- WHEN the form mounts
- THEN `periodId = X` (not auto-derived from date on mount)

#### Scenario JF-T07 — Edit mode date change re-selects

- GIVEN edit mode, user has NOT manually touched the period Select
- WHEN the user changes `date` to a value covered by period Z
- THEN `periodId` auto-updates to Z

#### Scenario JF-T04 (reset) — Form reset clears dirty-flag

- GIVEN the user had manually overridden `periodId`
- WHEN the form is reset
- THEN the dirty-flag clears and auto-selection resumes on the next date change

---

### REQ-2: Warning Banner on Uncovered Date

The form MUST display a non-blocking warning banner when `date` is set to a value not covered by any OPEN period. The warning MUST appear as soon as the uncovered date is set — not only on submit attempt.

Warning text (voseo): **`"No hay un período abierto que cubra esta fecha. Abrí el período correspondiente o elegí otra fecha."`**

The banner MUST have `role="alert"` and MUST NOT disable form fields other than the submit button (see REQ-3).

When the `date` changes back to a covered value, the warning MUST disappear and `periodId` MUST auto-set.

#### Scenario JF-T04 — No match → warning visible and submit disabled

- GIVEN `date` falls outside all OPEN periods
- WHEN `date` is set
- THEN the warning banner is visible in the DOM with `role="alert"`
- AND the submit button is disabled

#### Scenario JF-T05 — Match restored → warning hidden and submit re-enabled

- GIVEN the warning banner is visible after an uncovered date
- WHEN the user changes `date` to a value covered by an OPEN period
- THEN the warning banner is no longer visible
- AND `periodId` auto-sets to the matching period
- AND the submit button becomes enabled (assuming other fields are valid)

---

### REQ-3: Submit Guard

Submit MUST be disabled whenever `periodId` is empty. This is satisfied by the existing `canSubmit` guard which already requires `periodId` truthy. No additional guard logic is needed — REQ-1 ensures `periodId = ""` when no period covers the date, which is sufficient.

#### Scenario JF-T04 (submit) — Submit disabled on uncovered date

- GIVEN `date` is set to an uncovered value (no matching OPEN period)
- WHEN the form renders
- THEN the primary submit button is disabled

---

### REQ-4: Inclusive Boundary Matching

Date matching MUST be inclusive on both ends: `startDate ≤ date ≤ endDate`.

#### Scenario JF-T08 — Inclusive startDate boundary

- GIVEN `date = period.startDate` (e.g., `"2026-04-01"`)
- WHEN auto-selection runs
- THEN that period matches and `periodId` is set to it

#### Scenario JF-T09 — Inclusive endDate boundary

- GIVEN `date = period.endDate` (e.g., `"2026-04-30"`)
- WHEN auto-selection runs
- THEN that period matches and `periodId` is set to it

---

## Constraints

- Only OPEN periods are candidates for auto-selection; CLOSED and DRAFT periods MUST NOT match.
- The monthly-shape invariant (REQ-5 of `fiscal-period-creation-ux`) guarantees at most one OPEN period covers any date — no tie-breaking logic is needed.
- Date comparison MUST use string-slice (`"YYYY-MM-DD"` prefix) to avoid UTC/TZ shift errors. Do NOT construct `Date` objects from the `date` input string for comparison.
- Scope: `components/accounting/journal-entry-form.tsx` only. `create-journal-entry-form.tsx` has no `periods` prop and is out of scope.
