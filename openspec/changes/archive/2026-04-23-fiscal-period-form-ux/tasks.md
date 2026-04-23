# Tasks: fiscal-period-form-ux

**Change**: `fiscal-period-form-ux`
**Spec**: `openspec/changes/fiscal-period-form-ux/specs/fiscal-period-creation-ux/spec.md`
**Design**: `openspec/changes/fiscal-period-form-ux/design.md`
**TDD Mode**: Strict — every behavioral task has a RED pair before GREEN.

---

## Phase 0 — Sub-agent Check-in (MANDATORY)

- [x] **T-0 (CHORE)** Sub-agent check-in: confirm (1) current branch, (2) test suite baseline count, (3) no uncommitted changes, (4) all files to touch exist at expected paths.
  - Verify: `period-create-dialog.tsx` at `components/accounting/`, `fiscal-periods.service.ts` + `index.ts` at `features/fiscal-periods/`.
  - Commit: none — report only.

---

## Phase 1 — Foundation: `MONTH_NAMES_ES` extraction

> No behavior change — pure constant move. Covered by existing service tests staying green. No RED/GREEN pair needed.

- [x] **T-1 (REFACTOR)** Create `features/fiscal-periods/month-names.ts` — export `MONTH_NAMES_ES` (12 entries, `as const`) and `MonthNameEs` type. No `"server-only"` import.
  - Files: `features/fiscal-periods/month-names.ts` (CREATE)
  - Acceptance: file exports `MONTH_NAMES_ES` with 12 string entries; TypeScript compiles.
  - Commit: `refactor(fiscal-periods): extract MONTH_NAMES_ES to month-names.ts`

- [x] **T-2 (REFACTOR)** Update `features/fiscal-periods/fiscal-periods.service.ts` — replace local `const MONTH_NAMES_ES` with `import { MONTH_NAMES_ES } from "./month-names"`. Keep all existing behavior.
  - Files: `features/fiscal-periods/fiscal-periods.service.ts` (MODIFY)
  - Acceptance: `fiscal-periods.service.multiplicity.test.ts` stays green.
  - Commit: `refactor(fiscal-periods): import MONTH_NAMES_ES from month-names`

- [x] **T-3 (REFACTOR)** Update `features/fiscal-periods/index.ts` — add `export { MONTH_NAMES_ES } from "./month-names"`.
  - Files: `features/fiscal-periods/index.ts` (MODIFY)
  - Acceptance: `import { MONTH_NAMES_ES } from "@/features/fiscal-periods"` resolves without error in a client component.
  - Commit: `refactor(fiscal-periods): re-export MONTH_NAMES_ES from index`

---

## Phase 2 — Dialog UX: test file scaffold + placeholder/microcopia

- [x] **T-4.a (RED)** Create `components/accounting/__tests__/period-create-dialog.test.tsx` with failing tests for UX-T01 (placeholder `"Ej: Abril 2026"` and microcopia text present in DOM).
  - Files: `components/accounting/__tests__/period-create-dialog.test.tsx` (CREATE)
  - Acceptance: test file exists; `vitest` reports RED for UX-T01 assertions.
  - Commit: `test(period-create-dialog): RED UX-T01 placeholder + microcopia`

- [x] **T-4.b (GREEN)** In `period-create-dialog.tsx`: change `name` input placeholder to `"Ej: Abril 2026"`; add microcopia `<p>` with text `"Un período fiscal representa un mes contable. Cerrás uno por mes."` below `<DialogTitle>`.
  - Files: `components/accounting/period-create-dialog.tsx` (MODIFY)
  - Acceptance: UX-T01 passes (REQ-1).
  - Commit: `feat(period-create-dialog): add placeholder + microcopia (REQ-1)`

---

## Phase 3 — Month Select + Autocomplete

- [x] **T-5.a (RED)** Add failing tests for UX-T02 (month select renders 12 options; selecting Abril with year=2026 sets `startDate="2026-04-01"` and `endDate="2026-04-30"`).
  - Files: `components/accounting/__tests__/period-create-dialog.test.tsx` (MODIFY)
  - Acceptance: RED for UX-T02 assertions.
  - Commit: `test(period-create-dialog): RED UX-T02 month select autocomplete dates`

- [x] **T-5.b (GREEN)** Add `<Select>` of 12 months (Enero–Diciembre via `MONTH_NAMES_ES`) before date fields; add `selectedMonth` state; add `useEffect` watching `[selectedMonth, year]` that sets `startDate`/`endDate` from first/last day of month.
  - Files: `components/accounting/period-create-dialog.tsx` (MODIFY)
  - Acceptance: UX-T02 passes (REQ-2). Verify `Select` import against `node_modules/next/dist/docs/` if shadcn Select API is uncertain.
  - Commit: `feat(period-create-dialog): add month Select + date autocomplete (REQ-2)`

- [x] **T-6.a (RED)** Add failing test for UX-T03 (selecting Abril with year=2026 sets name field to `"Abril 2026"`).
  - Files: `components/accounting/__tests__/period-create-dialog.test.tsx` (MODIFY)
  - Acceptance: RED for UX-T03.
  - Commit: `test(period-create-dialog): RED UX-T03 month select autocomplete name`

- [x] **T-6.b (GREEN)** Extend `useEffect` to also set `name` to `"${MONTH_NAMES_ES[selectedMonth-1]} ${year}"` when `selectedMonth !== null`.
  - Files: `components/accounting/period-create-dialog.tsx` (MODIFY)
  - Acceptance: UX-T03 passes (REQ-2).
  - Commit: `feat(period-create-dialog): autocomplete name on month select (REQ-2)`

- [x] **T-7.a (RED)** Add failing test for UX-T04 (manual startDate edit after autocomplete retains manual value; subsequent month/year changes do NOT overwrite it).
  - Files: `components/accounting/__tests__/period-create-dialog.test.tsx` (MODIFY)
  - Acceptance: RED for UX-T04.
  - Commit: `test(period-create-dialog): RED UX-T04 manual override wins`

- [x] **T-7.b (GREEN)** Add `manualStartDate` / `manualEndDate` / `manualName` dirty-flags (or equivalent override mechanism); `useEffect` skips fields that were manually edited after last autocomplete.
  - Files: `components/accounting/period-create-dialog.tsx` (MODIFY)
  - Acceptance: UX-T04 passes (REQ-2). Dirty-flag approach: set flag on `onChange`; clear on month `<Select>` change.
  - Commit: `feat(period-create-dialog): manual edit overrides autocomplete (REQ-2)`

---

## Phase 4 — Cross-month Warning

- [x] **T-8.a (RED)** Add failing tests for UX-T05 (warning banner visible when `startDate="2026-01-01"` and `endDate="2026-12-31"`) and UX-T06 (warning does NOT disable submit button when required fields are filled).
  - Files: `components/accounting/__tests__/period-create-dialog.test.tsx` (MODIFY)
  - Acceptance: RED for UX-T05 and UX-T06.
  - Commit: `test(period-create-dialog): RED UX-T05 + UX-T06 cross-month warning`

- [x] **T-8.b (GREEN)** Add derived `crossMonthWarning` boolean (inline from `startDate`+`endDate` strings); render warning `<div>` with text `"Este período abarca más de un mes. Al cerrarlo, se bloquearán todos los comprobantes del período a la vez. ¿Es lo que querés?"` when true. Submit button remains enabled.
  - Files: `components/accounting/period-create-dialog.tsx` (MODIFY)
  - Acceptance: UX-T05 and UX-T06 pass (REQ-4). Trigger: `startDate.getMonth() !== endDate.getMonth()` OR `startDate.getDate() !== 1` OR `endDate !== lastDayOf(endDate.month)`.
  - Commit: `feat(period-create-dialog): add cross-month soft warning (REQ-4)`

---

## Phase 5 — Batch "Crear 12 meses"

- [x] **T-9.a (RED)** Add failing test for UX-T07 (batch button `"Crear los 12 meses de {year}"` renders; clicking it triggers exactly 12 `fetch` calls with correct month-derived `startDate`/`endDate`/`name` per call; `fetch` mocked to return 201).
  - Files: `components/accounting/__tests__/period-create-dialog.test.tsx` (MODIFY)
  - Acceptance: RED for UX-T07.
  - Commit: `test(period-create-dialog): RED UX-T07 batch button fires 12 requests`

- [x] **T-9.b (GREEN)** Add secondary `<Button>` labeled `"Crear los 12 meses de {year}"`; implement `handleBatch` — loops months 1..12 sequentially, calls `POST /api/organizations/${orgSlug}/periods` per month with derived payload; collects `{ created, skipped, failed }`.
  - Files: `components/accounting/period-create-dialog.tsx` (MODIFY)
  - Acceptance: UX-T07 passes (REQ-3). `isBatching` state disables both buttons during loop.
  - Commit: `feat(period-create-dialog): add batch "Crear 12 meses" button (REQ-3)`

- [x] **T-10.a (RED)** Add failing test for UX-T08 (3 of 12 fetch calls return 409 `FISCAL_PERIOD_MONTH_EXISTS`; handler continues; toast/summary shows `"9 períodos creados, 3 ya existían"`; dialog closes).
  - Files: `components/accounting/__tests__/period-create-dialog.test.tsx` (MODIFY)
  - Acceptance: RED for UX-T08.
  - Commit: `test(period-create-dialog): RED UX-T08 batch tolerates 409 duplicates`

- [x] **T-10.b (GREEN)** In `handleBatch`: detect 409 response with `FISCAL_PERIOD_MONTH_EXISTS` code → increment `skipped`, continue loop. After all 12 settle, call `toast.success("N períodos creados, M ya existían")` and call `onOpenChange(false)`.
  - Files: `components/accounting/period-create-dialog.tsx` (MODIFY)
  - Acceptance: UX-T08 passes (REQ-3).
  - Commit: `feat(period-create-dialog): batch skips 409 + shows result summary (REQ-3)`

- [x] **T-11.a (RED)** Add failing test for year input validation: year must be a 4-digit number in range 2000–2100; batch button disabled when year is out of range.
  - Files: `components/accounting/__tests__/period-create-dialog.test.tsx` (MODIFY)
  - Acceptance: RED for year-validation assertion.
  - Commit: `test(period-create-dialog): RED year validation for batch`

- [x] **T-11.b (GREEN)** Derive `isYearValid = year >= 2000 && year <= 2100`; disable batch button when `!isYearValid`.
  - Files: `components/accounting/period-create-dialog.tsx` (MODIFY)
  - Acceptance: year-validation test passes.
  - Commit: `feat(period-create-dialog): disable batch on invalid year`

---

## Phase 6 — Integration & Cleanup

- [x] **T-12 (VERIFY)** Run full test suite — 2697 tests passing (308 files). Baseline was 2681. +16 new tests.; confirm baseline count met (2681+ tests pass). Fix any regressions before proceeding.
  - Files: none (verify only)
  - Acceptance: `vitest run` exits 0 with ≥2681 tests passing.
  - Commit: none — fix any failures in prior task commits.

- [x] **T-13 (CHORE)** Run `tsc --noEmit` and linter — tsc: 0 errors. Lint: 0 errors on touched files (134 pre-existing errors in other files). (`eslint`/`next lint`); fix any type or lint errors introduced by this change.
  - Files: any files surfacing type errors.
  - Acceptance: zero type errors, zero lint errors on touched files.
  - Commit: `chore(fiscal-period-form-ux): fix lint/type errors post-implementation`

---

## Rule Check-ins

| Rule | Triggered? | Notes |
|------|-----------|-------|
| Rule 3 (retirement re-inventory) | NO | This change adds code only. The `MONTH_NAMES_ES` const is moved (not retired); the private const in `fiscal-periods.service.ts` is removed as part of T-2 — no API surface retired. |
| Rule 6 (canonical rule-application commit body) | NO | No named SDD Rule is the central rationale for any task. Commits use standard conventional format. |
| Rule 7 (invariant collision elevation) | NO | Design confirms no collisions. `PERMISSIONS_WRITE["period"]` unaffected; batch calls same endpoint 12×. `name` non-uniqueness noted (no collision). ESCALATE if discovered during apply. |

---

## Invariant Collisions

None. Design confirmed clean. Note for future: `FiscalPeriod.name` has no uniqueness constraint — two periods can share a name. Does not affect this change (autocomplete produces `"{MesES} {year}"` pairs that are distinct per month).

---

## Implementation Order Summary

1. **Phase 0** — confirm environment (no commits)
2. **Phase 1** — extract `MONTH_NAMES_ES` (T-1 → T-3); existing tests stay green
3. **Phase 2** — scaffold test file + RED UX-T01 → GREEN placeholder+microcopia (T-4.a → T-4.b)
4. **Phase 3** — RED UX-T02/03/04 → GREEN month Select + autocomplete + manual override (T-5 → T-7)
5. **Phase 4** — RED UX-T05/06 → GREEN cross-month warning (T-8)
6. **Phase 5** — RED UX-T07/08 → GREEN batch handler + 409 tolerance + year validation (T-9 → T-11)
7. **Phase 6** — full suite + lint/typecheck (T-12, T-13)
