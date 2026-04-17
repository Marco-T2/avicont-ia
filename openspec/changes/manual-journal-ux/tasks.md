# Tasks: manual-journal-ux

**Change**: `manual-journal-ux`
**Date**: 2026-04-17
**Artifact store**: hybrid (engram + openspec)
**TDD mode**: Strict — every REQ has at least one RED task before GREEN

---

## PR1: Shared plumbing

_Low-risk, no business logic. Enables PR2 (error code) and PR4 (sourceTypeLabel). Can merge first._

- [x] T1.1 RED (REQ-E.1) — Test that `AUTO_ENTRY_VOID_FORBIDDEN` is exported from errors.ts with the correct string value. File: `features/shared/__tests__/errors.auto-entry-void.test.ts` (new). Assert: `import { AUTO_ENTRY_VOID_FORBIDDEN } from "@/features/shared/errors"; expect(AUTO_ENTRY_VOID_FORBIDDEN).toBe("AUTO_ENTRY_VOID_FORBIDDEN")`.

- [x] T1.2 GREEN (REQ-E.1) — Add `AUTO_ENTRY_VOID_FORBIDDEN` constant to `features/shared/errors.ts` inside the "Asientos Contables" block (after ENTRY_VOIDED_IMMUTABLE). Exact addition: `export const AUTO_ENTRY_VOID_FORBIDDEN = "AUTO_ENTRY_VOID_FORBIDDEN";`.

- [x] T1.3 RED (REQ-B.3) — Create unit test file `features/accounting/__tests__/journal.ui.test.ts`. Assert all 6 S-B3 scenarios: `sourceTypeLabel(null)` → `"Manual"`, `"sale"` → `"Generado por Venta"`, `"purchase"` → `"Generado por Compra"`, `"dispatch"` → `"Generado por Despacho"`, `"payment"` → `"Generado por Pago"`, `"unknown_future_type"` → `"Generado automáticamente"` (fallback).

- [x] T1.4 GREEN (REQ-B.3) — Created `features/accounting/journal.ui.ts` (new file). Implemented `sourceTypeLabel(sourceType: string | null): string` with lookup map. Also implements `sourceTypeBadgeClassName(sourceType: string | null): string`. Named exports only, no default export.

---

## PR2: Void guard (REQ-E.1, REQ-E.2)

_Depends on T1.2 (error code). Merges after PR1._

- [x] T2.1 RED (REQ-E.1, S-E1.1) — Created `features/accounting/__tests__/journal.service.void-guard.test.ts`. Scenario S-E1.1: call `transitionStatus(orgId, autoEntryId, "VOIDED", userId)` on a JE with `sourceType="sale"`. Assert throws `ValidationError` with `code === AUTO_ENTRY_VOID_FORBIDDEN`. Mocked repo.findById.

- [x] T2.2 RED (REQ-E.1, S-E1.2) — In same file, scenario: `transitionStatus` with `sourceType=null` and `targetStatus="VOIDED"` → resolves (no AUTO_ENTRY_VOID_FORBIDDEN). Also covers S-E1.4 (non-VOIDED target on auto-JE → no guard).

- [x] T2.3 RED (REQ-E.2, S-E2.1) — In same file: architectural invariant test — tx.journalEntry.update (cascade path) does NOT throw AUTO_ENTRY_VOID_FORBIDDEN. Documents D.7 design contract.

- [x] T2.4 GREEN (REQ-E.1) — Added guard to `features/accounting/journal.service.ts:transitionStatus` BEFORE existing VOIDED check. Import and throw `AUTO_ENTRY_VOID_FORBIDDEN` when `targetStatus === "VOIDED" && entry.sourceType !== null`.

- [x] T2.5 RED → GREEN (REQ-E.1 API boundary) — Created `app/api/organizations/[orgSlug]/journal/[entryId]/status/__tests__/route.void-guard.test.ts`. PATCH route returns 422 with AUTO_ENTRY_VOID_FORBIDDEN for auto-JE void; 200 for manual void.

---

## PR3: Edit page unlock (REQ-A.1)

_Independent of PR2. Can be implemented in parallel after PR1 merges (no strict dependency). Merges after PR1._

- [x] T3.1 RED (REQ-A.1, S-A1.2) — Created `app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/edit/__tests__/page.test.ts`. POSTED + sourceType=null → assert `redirect()` NOT called. RED: existing guard redirected all POSTED.

- [x] T3.2 RED (REQ-A.1, S-A1.3 + S-A1.4) — In same file: POSTED + sourceType="sale" → redirect; POSTED + sourceType="purchase" → redirect. (Passed from the start — current guard too strict was fine here.)

- [x] T3.3 RED (REQ-A.1, S-A1.1 regression) — DRAFT + sourceType=null → redirect NOT called. Passed from the start.

- [x] T3.4 RED (REQ-A.1, S-A1.5) — VOIDED + sourceType=null and VOIDED + sourceType="sale" → redirect called. Passed from the start.

- [x] T3.5 GREEN (REQ-A.1) — Relaxed guard in `app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/edit/page.tsx`. Replaced single `status !== "DRAFT"` check with `isEditable` boolean per design D.3. All 6 page tests pass.

---

## PR4: Origin badge (REQ-B.1, REQ-B.2, REQ-B.3)

_Depends on T1.4 (sourceTypeLabel). Merges after PR1._

- [ ] T4.1 RED (REQ-B.1, S-B1.1..S-B1.5) — Create `components/accounting/__tests__/journal-entry-list.test.tsx`. Render `JournalEntryList` with 5 fixture entries each with a different `sourceType` (null, "sale", "purchase", "dispatch", "payment"). Assert badges "Manual", "Generado por Venta", "Generado por Compra", "Generado por Despacho", "Generado por Pago" are visible in the DOM (`screen.getByText`).

- [ ] T4.2 RED (REQ-B.2, S-B2.1 + S-B2.2) — Create `components/accounting/__tests__/journal-entry-detail.test.tsx`. Render `JournalEntryDetail` once with `sourceType=null` and once with `sourceType="sale"`. Assert badge "Manual" / "Generado por Venta" appears in the metadata section.

- [ ] T4.3 GREEN (REQ-B.1) — Update `components/accounting/journal-entry-list.tsx`: (a) extend local `JournalEntry` interface to include `sourceType: string | null`; (b) import `sourceTypeLabel, sourceTypeBadgeClassName` from `@/features/accounting/journal.ui`; (c) add a badge cell in the list row using `sourceTypeLabel(entry.sourceType)` and `sourceTypeBadgeClassName(entry.sourceType)` for styling.

- [ ] T4.4 GREEN (REQ-B.2) — Update `components/accounting/journal-entry-detail.tsx`: (a) extend local `entry` type to include `sourceType: string | null`; (b) import `sourceTypeLabel, sourceTypeBadgeClassName` from `@/features/accounting/journal.ui`; (c) add badge in the header metadata block.

---

## PR5: Manual/Auto filter (REQ-C.1)

_Depends on PR4 (list component already updated). Can overlap in implementation with PR4. Merges after PR4._

- [ ] T5.1 RED (REQ-C.1, S-C1.1) — Create `features/accounting/__tests__/journal.repository.origin-filter.test.ts`. Seed 1 manual JE (`sourceType=null`) and 1 auto JE (`sourceType="sale"`). Call `repo.findAll(orgId, { origin: "manual" })`. Assert result length is 1 and the entry has `sourceType === null`.

- [ ] T5.2 RED (REQ-C.1, S-C1.2) — In same file: call `repo.findAll(orgId, { origin: "auto" })`. Assert result length is 1 and the entry has `sourceType !== null`.

- [ ] T5.3 RED (REQ-C.1, S-C1.3 + S-C1.4) — In same file: (a) `findAll(orgId, {})` → both entries returned (length 2); (b) `findAll(orgId, { origin: "manual", periodId: somePeriod })` → only the manual entry of that period (composability check).

- [ ] T5.4 RED (REQ-C.1, S-C1.5) — In `components/accounting/__tests__/journal-entry-list.test.tsx` (add scenario): render `JournalEntryList` with `filters.origin="auto"`. Assert the origin `<Select>` control shows the value "Automático" as selected.

- [ ] T5.5 GREEN (REQ-C.1) — Add `origin?: "manual" | "auto"` to `JournalFilters` interface in `features/accounting/journal.types.ts` (line 51, after `status?: JournalEntryStatus`).

- [ ] T5.6 GREEN (REQ-C.1) — Update `features/accounting/journal.repository.ts` inside `findAll()`: translate `filters.origin` to Prisma `where.sourceType` conditions per design D.4. `"manual"` → `where.sourceType = null`; `"auto"` → `where.sourceType = { not: null }`.

- [ ] T5.7 GREEN (REQ-C.1) — Update `app/(dashboard)/[orgSlug]/accounting/journal/page.tsx`: parse `sp.origin` searchParam (`"manual"` | `"auto"`) and pass it as `filters.origin` to the repository call and as a prop to `JournalEntryList`.

- [ ] T5.8 GREEN (REQ-C.1) — Update `components/accounting/journal-entry-list.tsx`: (a) extend `JournalEntryListProps.filters` to include `origin?: "manual" | "auto"`; (b) add `<Select>` control "Origen" sibling to the Status select per design D.4 snippet; (c) extend `applyFilter` to handle the `origin` key; (d) extend `hasFilters` to include `origin` in the active-filter check.

---

## PR6: Display-date fix (REQ-D.1, REQ-D.2)

_Independent of all other PRs (purely mechanical swap). Can be implemented after PR1 or in parallel. Merges last to avoid merge conflicts with PR4/PR5 which also touch list and detail._

- [ ] T6.1 RED (REQ-D.1, S-D.1) — In `components/accounting/__tests__/journal-entry-list.test.tsx` (add scenario or create dedicated date test block): use `vi.useFakeTimers()` + `vi.setSystemTime("2026-04-18T01:00:00.000Z")`. Render list with entry `date = "2026-04-17T00:00:00.000Z"`. Assert `screen.getByText("17/04/2026")` is in the document. Also assert `screen.queryByText("16/04/2026")` is null.

- [ ] T6.2 RED (REQ-D.1, S-D.2 + S-D.3) — In same file: (a) render with `date = "2026-04-17T12:00:00.000Z"` → assert `"17/04/2026"` visible; (b) render with `date = null` → assert no crash and date cell renders `""`.

- [ ] T6.3 RED (REQ-D.2, S-D.1) — In `components/accounting/__tests__/journal-entry-detail.test.tsx` (add scenario): same fake-timer pattern. Render detail with `date = "2026-04-17T00:00:00.000Z"`. Assert `screen.getByText("17/04/2026")` visible. Assert `screen.queryByText("16/04/2026")` is null.

- [ ] T6.4 RED (REQ-D.2, S-D.2 + S-D.3) — In same detail test file: (a) noon UTC → `"17/04/2026"`; (b) null date → no crash, empty string rendered.

- [ ] T6.5 GREEN (REQ-D.1) — Update `components/accounting/journal-entry-list.tsx`: (a) remove the local `formatDate` function (lines 27-33); (b) add `import { formatDateBO } from "@/lib/date-utils"`; (c) replace all call sites `formatDate(x)` with `formatDateBO(x)`. Only one call site expected (line ~269).

- [ ] T6.6 GREEN (REQ-D.2) — Update `components/accounting/journal-entry-detail.tsx`: (a) remove the local `formatDate` function (lines 32-38); (b) add `import { formatDateBO } from "@/lib/date-utils"`; (c) replace all call sites `formatDate(x)` with `formatDateBO(x)`. Two call sites expected (lines ~190 and ~210).

- [ ] T6.7 CLEANUP (REQ-D.1, REQ-D.2) — Search `components/accounting/__tests__/` for any existing test assertions using locale-format strings (`"17 abr 2026"`, `"17 de abril de 2026"`, `"abr"`, `"abril"`) and migrate them to `"DD/MM/YYYY"` format. Verify with grep: `grep -rn "abr\|abril" components/accounting/__tests__/`. Update affected test expectations to match `formatDateBO` output.

---

## Deployment Order

```
PR1 (shared plumbing: errors.ts + journal.ui.ts)
  ↓
  ├── PR2 (void guard — depends on AUTO_ENTRY_VOID_FORBIDDEN from T1.2)
  ├── PR3 (edit page unlock — independent after PR1)
  └── PR4 (origin badge — depends on sourceTypeLabel from T1.4)
        ↓
        PR5 (origin filter — extends the list component updated in PR4)
              ↓ (merge after PR5 to avoid list/detail conflicts)
              PR6 (display-date fix — touches same list + detail files)
```

PR2 and PR3 can be reviewed/merged in parallel once PR1 is in.
PR6 should be the last to merge to minimize conflicts with PR4/PR5 list changes.

---

## REQ Coverage Summary

| REQ | PR | Tasks (RED/GREEN/OTHER) |
|-----|----|-------------------------|
| REQ-A.1 | PR3 | T3.1, T3.2, T3.3, T3.4 (RED) + T3.5 (GREEN) |
| REQ-B.1 | PR4 | T4.1 (RED) + T4.3 (GREEN) |
| REQ-B.2 | PR4 | T4.2 (RED) + T4.4 (GREEN) |
| REQ-B.3 | PR1 | T1.3 (RED) + T1.4 (GREEN) |
| REQ-C.1 | PR5 | T5.1, T5.2, T5.3, T5.4 (RED) + T5.5, T5.6, T5.7, T5.8 (GREEN) |
| REQ-D.1 | PR6 | T6.1, T6.2 (RED) + T6.5 (GREEN) + T6.7 (CLEANUP) |
| REQ-D.2 | PR6 | T6.3, T6.4 (RED) + T6.6 (GREEN) + T6.7 (CLEANUP) |
| REQ-E.1 | PR2 | T2.1, T2.2, T2.3 (RED) + T2.5 (GREEN) |
| REQ-E.2 | PR2 | T2.4 (RED) — cascade test verifies no regression |
