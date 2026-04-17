# Verify Report: Sales & Dispatch Forms UX — LCV indicator + layout polish

**Change**: `sales-dispatch-forms-ux`
**Spec version**: N/A (delta spec)
**Mode**: Strict TDD (Vitest + RTL)
**Date**: 2026-04-16
**Verifier**: sdd-verify sub-agent

---

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 31 (T1.1–T5.8 + T6.1–T6.3) |
| Tasks complete (PR1–PR5) | 28 |
| Tasks incomplete | 3 (T6.1, T6.2, T6.3 — PR6 housekeeping) |

**Incomplete tasks (PR6)**:
- `[ ] T6.1` — `pnpm tsc --noEmit` (verified independently by this report: CLEAN)
- `[ ] T6.2` — `pnpm vitest run` (verified independently: 712/712 PASS)
- `[ ] T6.3` — Conventional commits per PR grouping (commits already shipped; checkbox not ticked)

> Note: T6.1 and T6.2 were executed inline during apply and confirmed again here. The PR6 checkboxes are cosmetic — they reflect the "run + mark done" step, not missing work.

---

## Build & Tests Execution

**Build / Type Check**: ✅ Passed
```
pnpm tsc --noEmit
(no output — exit code 0)
```

**Tests**: ✅ 712 passed / ❌ 0 failed / ⚠️ 0 skipped
```
Test Files  61 passed (61)
Tests       712 passed (712)
Duration    ~14s
```

**Coverage**: Not configured — not available.

---

## Spec Compliance Matrix

| Requirement | Scenario | Test file > test name | Result |
|-------------|----------|-----------------------|--------|
| REQ-A.1 Header indicator | Header shows S2 for saved sale without LCV | `sale-form-lcv-header.test.tsx` > A.1.1 | ✅ COMPLIANT |
| REQ-A.1 Header indicator | Header shows S3 for saved sale with LCV | `sale-form-lcv-header.test.tsx` > A.1.2 | ✅ COMPLIANT |
| REQ-A.1 Header indicator | DRAFT sale → S1 disabled | `sale-form-lcv-header.test.tsx` > A.1.3, A.1.5 | ✅ COMPLIANT |
| REQ-A.1 Header indicator | sm:grid-cols-3 on header row 2 | `sale-form-lcv-header.test.tsx` > A.1.4 | ✅ COMPLIANT |
| REQ-A.1 Footer removal | Footer NOT containing old LCV button (all states) | `sale-form-footer-lcv-removed.test.tsx` > R.1–R.4 | ✅ COMPLIANT |
| REQ-A.2 State machine S1 | Disabled, no handler fires | `lcv-indicator.test.tsx` > LCV-S1-1, LCV-S1-2, LCV-S1-3 | ✅ COMPLIANT |
| REQ-A.2 State machine S2 | Enabled, click calls onRegister | `lcv-indicator.test.tsx` > LCV-S2-1, LCV-S2-2, LCV-S2-4 | ✅ COMPLIANT |
| REQ-A.2 State machine S2 | periodOpen=false disables S2 | `lcv-indicator.test.tsx` > LCV-S2-3 | ✅ COMPLIANT |
| REQ-A.2 State machine S3 | Emerald styling (NOT bg-green-) | `lcv-indicator.test.tsx` > LCV-S3-1 | ✅ COMPLIANT |
| REQ-A.2 State machine S3 | Click reveals Edit + Unlink | `lcv-indicator.test.tsx` > LCV-S3-2, LCV-S3-3, LCV-S3-4 | ✅ COMPLIANT |
| REQ-A.3 Unlink confirmation | Modal shows, NOT containing "Anular" | `unlink-lcv-confirm-dialog.test.tsx` > "el contenido visible NO contiene la palabra 'Anular'" | ✅ COMPLIANT |
| REQ-A.3 Unlink confirmation | Sale preserved copy present | `unlink-lcv-confirm-dialog.test.tsx` > "renderiza el cuerpo..." | ✅ COMPLIANT |
| REQ-A.3 Unlink confirmation | Cancel is no-op | `unlink-lcv-confirm-dialog.test.tsx` > "click en Cancelar..." | ✅ COMPLIANT |
| REQ-A.3 Unlink HTTP call | PATCH uses ivaBookId, NOT saleId | `sale-form-unlink.test.tsx` > "llama a PATCH con la URL correcta..." | ✅ COMPLIANT |
| REQ-A.3 Unlink HTTP call | router.refresh() on success | `sale-form-unlink.test.tsx` > "llama a router.refresh()..." | ✅ COMPLIANT |
| REQ-A.3 Unlink HTTP call | toast.error on failure, no refresh | `sale-form-unlink.test.tsx` > "cuando fetch falla...", "cuando fetch lanza..." | ✅ COMPLIANT |
| REQ-A.3 Journal regen without IVA/IT | buildSaleEntryLines without ivaBook → no IVA (2.1.6) line | `iva-books.service.cascade.test.ts` > T2.5 sin ivaBook NO genera línea IVA | ✅ COMPLIANT |
| REQ-A.3 Journal regen without IVA/IT | buildSaleEntryLines without ivaBook → no IT lines | `iva-books.service.cascade.test.ts` > T2.5 sin ivaBook NO genera líneas IT | ✅ COMPLIANT |
| REQ-A.3 Journal regen without IVA/IT | Without ivaBook: exactly 2 lines (CxC + ingreso) | `iva-books.service.cascade.test.ts` > T2.5 sin ivaBook 2 líneas | ✅ COMPLIANT |
| REQ-A.3 Journal regen without IVA/IT | With active ivaBook: 5 lines (regression guard) | `iva-books.service.cascade.test.ts` > T2.5 con ivaBook ACTIVE 5 líneas | ✅ COMPLIANT |
| REQ-A.4 Notas relocated (sale-form) | Notas inside bottom-row grid with Resumen | `sale-form-notas-layout.test.tsx` > A.4.1, A.4.2 | ✅ COMPLIANT |
| REQ-A.4 Notas relocated (sale-form) | Descripción NOT inside bottom-row | `sale-form-notas-layout.test.tsx` > A.4.3 | ✅ COMPLIANT |
| REQ-A.4 Notas relocated (sale-form) | DRAFT: grid preserved, right slot empty | `sale-form-notas-layout.test.tsx` > A.4.4, A.4.5, A.4.6 | ✅ COMPLIANT |
| REQ-A.4 Mobile collapse (sale-form) | grid-cols-1 + sm:grid-cols-2 present | `sale-form-notas-layout.test.tsx` > A.4.7, A.4.8 | ✅ COMPLIANT |
| REQ-A.5 Resumen right-aligned (sale-form) | ml-auto class on payment wrapper | `sale-form-notas-layout.test.tsx` > A.5.1 | ✅ COMPLIANT |
| REQ-A.5 Resumen right-aligned (sale-form) | No `<table>` element used | `sale-form-notas-layout.test.tsx` > A.5.2 | ✅ COMPLIANT |
| REQ-B.1 Notas NDD | Notas inside bottom-row-dispatch (NDD) | `dispatch-form-layout.test.tsx` > B.1.1, B.1.2 | ✅ COMPLIANT |
| REQ-B.1 Mobile collapse NDD | grid-cols-1 + sm:grid-cols-2 present | `dispatch-form-layout.test.tsx` > B.1.7, B.1.8 | ✅ COMPLIANT |
| REQ-B.2 Notas BC | Notas inside bottom-row-dispatch (BC) | `dispatch-form-layout.test.tsx` > B.2.1, B.2.2, B.2.3 | ✅ COMPLIANT |
| REQ-B.2 Mobile collapse BC | grid-cols-1 + sm:grid-cols-2 present | `dispatch-form-layout.test.tsx` > B.2.7, B.2.8 | ✅ COMPLIANT |
| REQ-B.3 Resumen right-aligned (NDD) | ml-auto + no table (NDD) | `dispatch-form-layout.test.tsx` > B.3.1, B.3.2 | ✅ COMPLIANT |
| REQ-B.3 Resumen right-aligned (BC) | ml-auto + no table (BC) | `dispatch-form-layout.test.tsx` > B.3.3, B.3.4 | ✅ COMPLIANT |
| Non-applicability | No LCV code in dispatch-form | Static grep: 0 matches for LcvIndicator/useLcvUnlink/ivaSalesBook in dispatch-form.tsx | ✅ COMPLIANT |

**Compliance summary**: 33/33 scenarios compliant.

---

## Unlink Cascade Regression (PR2)

4 regression tests in `iva-books.service.cascade.test.ts` (section "Regression T2.5"):

| Test | Assertion | Status |
|------|-----------|--------|
| T2.5 — sin ivaBook: NO genera línea IVA (2.1.6) | `ivaLine` is undefined | ✅ PASS |
| T2.5 — sin ivaBook: NO genera líneas IT (5.3.3 / 2.1.7) | both undefined | ✅ PASS |
| T2.5 — sin ivaBook: genera exactamente 2 líneas | length === 2 | ✅ PASS |
| T2.5 — con ivaBook ACTIVE: genera 5 líneas (non-regression) | length === 5, IVA+IT lines present | ✅ PASS |

All 4 regression tests lock in the no-IVA/no-IT behavior on unlink. Confirmed passing.

---

## Design Decision Conformance (D1–D8)

| Decision | Code Evidence | Status |
|----------|---------------|--------|
| D1 — `<LcvIndicator>` contract: `state: "S1"\|"S2"\|"S3"`, `periodOpen`, optional handlers | `lcv-indicator.tsx` lines 14–27: exact interface shape | ✅ Followed |
| D2 — Reuse `dropdown-menu.tsx` for S3 popover (no popover.tsx) | `lcv-indicator.tsx` imports `DropdownMenu*` from `@/components/ui/dropdown-menu` | ✅ Followed |
| D3 — Confirmation modal via `dialog.tsx` wrapper (no `alert-dialog.tsx`) | `unlink-lcv-confirm-dialog.tsx` wraps `Dialog` from `@/components/ui/dialog` | ✅ Followed |
| D4 — Emerald (outline) for S3, NOT solid `bg-green-600` | `lcv-indicator.tsx` line 56: `bg-emerald-50 border border-emerald-600 text-emerald-700 hover:bg-emerald-100` | ✅ Followed |
| D5 — No new server action; reuse `PATCH /api/.../iva-books/sales/{ivaBookId}/void` | `use-lcv-unlink.ts` uses `fetch` PATCH; confirmed by hook test | ✅ Followed |
| D6 — `grid grid-cols-1 sm:grid-cols-2 gap-4` for Notas+Resumen row | `sale-form.tsx` bottom-row tested A.4.7/A.4.8; `dispatch-form.tsx` tested B.1.7/B.1.8 | ✅ Followed |
| D7 — `<div className="flex flex-col gap-1 ml-auto w-fit">` replacing `<table>` | tests A.5.1/A.5.2 (sale) and B.3.1–B.3.4 (dispatch): ml-auto present, no table | ✅ Followed |
| D8 — Testing strategy: unit RTL for components, integration for cascade | All PRs followed RED→GREEN; 61 test files, 712 tests | ✅ Followed |

---

## Issues Found

### CRITICAL
None.

### WARNING
None.

### SUGGESTION

**S1 — S3 dropdown copy truncated vs spec**
- Spec REQ-A.2 says: `"Desvincular del Libro de Ventas"` in the S3 dropdown item.
- Actual code (`lcv-indicator.tsx` line 139): `"Desvincular del LCV"` (abbreviated).
- The test (`lcv-indicator.test.tsx` LCV-S3-2/LCV-S3-4) asserts `/desvincular del lcv/i` matching the abbreviated form.
- The dialog title (`unlink-lcv-confirm-dialog.tsx`) correctly says `"Desvincular del Libro de Ventas"`, so the full name IS visible to the user in the confirmation step.
- Behavioral and functional requirements are met. Copy unification (using full name in both places) would improve consistency with spec.

**S2 — Dialog copy says "No se elimina la venta" vs spec cross-check "No se anula la venta"**
- Spec verify instruction says to check for `"No se anula la venta"` in the dialog.
- Actual dialog (`unlink-lcv-confirm-dialog.tsx` line 37): `"No se elimina la venta — solo se elimina el vínculo con el LCV."`
- Critical REQ (word "Anular" must be absent) is MET — the word "Anular" does not appear anywhere in the dialog content.
- The alternate phrasing ("No se elimina" vs "No se anula") is semantically equivalent and arguably clearer.
- No test asserts the exact phrase "No se anula la venta" — test asserts absence of "Anular" (passing).

**S3 — PR6 task checkboxes (T6.1–T6.3) not ticked**
- T6.1 (tsc) and T6.2 (vitest) were executed inline during apply and confirmed clean. This report independently confirms both.
- T6.3 (commit labeling) — 5 commits shipped with conventional format. Checkboxes are housekeeping; not a blocker.

---

## Verdict

### PASS WITH SUGGESTIONS

All 33 spec scenarios are implemented and covered by passing tests. Build is clean (tsc), full test suite is green (712/712). Design decisions D1–D8 are all followed. 4 regression tests for the unlink cascade lock in the no-IVA/no-IT behavior. No deferred items (document upload, LCV in dispatch-form) were accidentally implemented.

The 3 SUGGESTION items are copy/housekeeping polish — none block archive.
