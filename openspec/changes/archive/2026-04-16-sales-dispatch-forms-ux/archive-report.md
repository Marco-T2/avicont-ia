# Archive Report: Sales & Dispatch Forms UX — LCV indicator + layout polish

**Change**: `sales-dispatch-forms-ux`  
**Archived**: 2026-04-16  
**Status**: COMPLETE — PASS WITH SUGGESTIONS  
**Verdict**: All 33 scenarios compliant, 712/712 tests passing, 0 critical issues.

---

## Intent & Scope

### What Was Built
A UX improvement cycle for sales and dispatch forms, addressing:
1. **Visibility gap**: LCV vinculation state was buried in footer next to destructive actions with no way to reverse a mistake.
2. **Layout pain points**: Notas field mid-form next to Descripción (redundant), Resumen de Cobros payment rows stretched edge-to-edge.

### What Shipped
- **Sale form**: LCV indicator relocated to header row 2 with stateful S1/S2/S3 rendering + unlink flow; Notas relocated to bottom row sharing with Resumen; payment detail rows right-aligned.
- **Dispatch form**: Notas + Resumen layout changes applied to NOTA_DE_DESPACHO and BOLETA_CERRADA variants (LCV explicitly NOT applied per scope).

---

## Capabilities Modified

### sale-form-ui
- **LCV Indicator (S1/S2/S3)**: 
  - S1 (draft): Grey, disabled — no interaction.
  - S2 (saved, no IvaSalesBook): Neutral — click opens register-in-LCV modal.
  - S3 (saved, linked): Emerald (distinct from CTA green) — click reveals Edit + Unlink popover.
- **Unlink Flow**: Void IvaSalesBook + regenerate sale journal WITHOUT IVA/IT lines. Reuses existing `PATCH /api/iva-books/sales/[id]/void` endpoint.
- **Layout (Notas + Resumen)**: Bottom row, side-by-side at `sm:` and above, single-column below.
- **Resumen Right-Alignment**: Payment detail rows flush right via `ml-auto w-fit` flex layout.
- **Removed**: "Registrar Libro de Ventas" footer button (replaced by header indicator).

### dispatch-form-ui
- **Notas Relocation**: Moved to bottom row sharing with Resumen de Cobros in NDD + BC variants.
- **Resumen Right-Alignment**: Payment rows flush right in both NDD and BC.
- **Non-applicability**: No LCV indicator, no unlink flow, no LCV footer button in any dispatch variant.

---

## Files Touched

### New Components
- `components/sales/lcv-indicator.tsx` — Presentational component, S1/S2/S3 rendering.
- `components/sales/unlink-lcv-confirm-dialog.tsx` — Confirmation dialog wrapper (mirrors ConfirmTrimDialog pattern).
- `components/sales/use-lcv-unlink.ts` — Custom hook for unlink state and mutation.

### New Tests
- `components/sales/__tests__/lcv-indicator.test.tsx` — S1/S2/S3 render + click scenarios.
- `components/sales/__tests__/unlink-lcv-confirm-dialog.test.tsx` — Confirmation copy + actions.
- `components/sales/__tests__/sale-form-unlink.test.tsx` — Full unlink flow integration.
- `components/sales/__tests__/sale-form-lcv-header.test.tsx` — LCV indicator in header row 2.
- `components/sales/__tests__/sale-form-footer-lcv-removed.test.tsx` — "Registrar" button removal verification.
- `components/sales/__tests__/sale-form-notas-layout.test.tsx` — Notas/Resumen bottom-row layout.
- `components/dispatches/__tests__/dispatch-form-layout.test.tsx` — Dispatch-form NDD/BC layout changes.

### Modified Components
- `components/sales/sale-form.tsx` — LCV indicator in row 2, footer button removal, Notas/Resumen relocation, unlink handler wiring.
- `components/dispatches/dispatch-form.tsx` — Notas + Resumen relocation for NDD + BC variants, right-align layout.
- `components/sales/__tests__/sale-form-iva-gate.test.tsx` — Regression test for IVA gate with new layout.
- `features/accounting/iva-books/__tests__/iva-books.service.cascade.test.ts` — Cascade test: journal regeneration without IVA/IT.

---

## Key Decisions

### D1. LcvIndicator Contract
Presentational component with explicit state prop (`"S1" | "S2" | "S3"`). Parent (`sale-form.tsx`) derives state from `(isEditMode, sale.id, sale.ivaSalesBook)`. Tradeoff: explicit wins for testability over computed state.

### D2. Popover Primitive
Reused `components/ui/dropdown-menu.tsx` for S3 Edit/Unlink menu. No new shadcn primitives (`popover.tsx`, `alert-dialog.tsx`) — they don't exist in repo. Followed existing patterns: `dropdown-menu.tsx` + custom wrapper.

### D3. Confirmation Modal
Reused `components/ui/dialog.tsx` with custom wrapper (`unlink-lcv-confirm-dialog.tsx`) mirroring `ConfirmTrimDialog` pattern. Copy explicitly avoids "Anular" — uses "Desvincular" + "sale is preserved" messaging.

### D4. Emerald Color Distinction
S3 state rendered as `bg-emerald-50 border border-emerald-700 text-emerald-700 hover:bg-emerald-100` (outline). Save-CTA is `bg-green-600 hover:bg-green-700` (solid). Two-axis distinction (hue + style) prevents confusion.

### D5. No New Server Action
Project has zero `"use server"` declarations. All mutations via `fetch` + API route. Unlink reuses existing `PATCH /api/organizations/{orgSlug}/iva-books/sales/{ivaBookId}/void` which already calls `IvaBooksService.voidSale(orgId, userId, id)` → triggers `maybeRegenerateJournal` bridge.

### D6. Layout Grid
Bottom row uses `grid grid-cols-1 sm:grid-cols-2 gap-4`. Collapses to single column below `sm:` breakpoint.

### D7. Right-Alignment Strategy
Refactored Resumen `<table>` into `<div className="flex flex-col gap-1 ml-auto w-fit">`. Each row uses `flex justify-between gap-4`. `ml-auto w-fit` pushes entire group right without stretching.

### D8. Dispatch Parity
Applied D6 + D7 to `dispatch-form.tsx` for both NDD and BC variants. Third variant (REMITO) explicitly out of scope.

---

## Discoveries

### `@testing-library/user-event` Not Available
Package not installed. Radix triggers require fallback pattern: `fireEvent.pointerDown()` + `click()` to properly activate dropdown/popover components in tests.

### IvaBookSaleModal Auto-Detect
Modal auto-detects create vs edit mode via `sale.ivaSalesBook` presence. "Editar registro LCV" in S3 menu reuses same modal component with no second modal state needed.

### NDD + BC Code Path Unity
Dispatch-form Notas and Resumen code path is NOT branched by variant. One change to `dispatch-form.tsx` covers both NDD and BC. Third variant (REMITO) has different structure — out of scope.

### TS Strict Mode: `null` vs `undefined`
Test fixtures with `receivable: null` fail strict checks. Must use `undefined` (field omission). Status casting to `any` for test fixtures since narrower type in prop vs test data.

### Resumen Card Was Standalone
Dispatch-form Resumen de Cobros Card existed OUTSIDE the form Card (after detail table). Had to relocate wholesale into bottom-row grid, not just reposition within Card.

---

## Artifacts Summary

| Artifact | Engram ID | File Path | Status |
|----------|-----------|-----------|--------|
| Proposal | #634 | `openspec/changes/sales-dispatch-forms-ux/proposal.md` | ARCHIVED |
| Spec | #635 | `openspec/changes/sales-dispatch-forms-ux/spec.md` | ARCHIVED |
| Design | #636 | `openspec/changes/sales-dispatch-forms-ux/design.md` | ARCHIVED |
| Tasks | (not found in engram) | `openspec/changes/sales-dispatch-forms-ux/tasks.md` | ARCHIVED |
| Apply Progress | #639 | (engram only) | ARCHIVED |
| Verify Report | #641 | `openspec/changes/sales-dispatch-forms-ux/verify-report.md` | ARCHIVED |
| Archive Report | (this file) | `openspec/changes/sales-dispatch-forms-ux/archive-report.md` | ARCHIVED |

---

## Test Metrics

- **Total**: 712 / 712 passing
- **Files**: 61 test files
- **Regressions**: 0
- **Critical Issues**: 0
- **Warnings**: 0
- **Suggestions**: 3 (cosmetic, non-blocking)

### Compliance: 33/33 Scenarios
All REQ-A.1 through REQ-A.6 and REQ-B.1 through REQ-B.3 scenarios validated with passing test suites.

---

## Shipped Commits

| Commit | PR | Scope |
|--------|----|----|
| `4ffd478` | PR1 | LcvIndicator component |
| `90bf99b` | PR2 | Unlink flow + confirm dialog |
| `45b6a8b` | PR3 | LCV indicator in sale-form header |
| `b594696` | PR4 | Sale-form Notas + Resumen layout |
| `52edcf7` | PR5 | Dispatch-form Notas + Resumen layout |

---

## Deferred Items (Out of Scope)

- **Document upload field** in Resumen area — explicitly requested deferral per proposal.
- **LCV logic for dispatches** — non-applicability confirmed per design D8.
- **Third dispatch variant (REMITO)** — out of scope; NDD + BC complete.

---

## Followup Suggestions (Cosmetic, Optional)

1. **S1: Dropdown menu copy** — "Desvincular del LCV" (abbreviated) could be "Desvincular del Libro de Ventas" (full name). Dialog already uses full name correctly. Low priority.

2. **S2: Dialog phrasing** — "No se elimina la venta" vs spec cross-check "No se anula la venta". Both semantically correct; "Anular" is absent as required. Low priority.

3. **S3: Task checkboxes** — PR6 tasks T6.1–T6.3 not ticked in `tasks.md`. Work verified complete; cosmetic checkbox update only.

These are cosmetic and not scheduled unless user requests.

---

## DAG State: CLOSED

All SDD phases complete and archived:
- ✅ Proposal
- ✅ Spec
- ✅ Design
- ✅ Tasks
- ✅ Apply (5 PRs shipped)
- ✅ Verify (PASS WITH SUGGESTIONS)
- ✅ Archive (this report)

---

## SDD Cycle Complete

The `sales-dispatch-forms-ux` change has completed the full specification-driven development lifecycle:

1. **Proposal**: UX problem articulated, scope defined, success criteria established.
2. **Spec**: 33 scenarios written, covering both sale-form and dispatch-form domains.
3. **Design**: Technical approach chosen; 8 key decisions documented; file changes mapped.
4. **Tasks**: 47 implementation tasks broken down across 6 PRs.
5. **Apply**: 5 PRs shipped with 712 tests green, 0 regressions.
6. **Verify**: All scenarios validated; 0 critical issues; ready for production.
7. **Archive**: All artifacts persisted; audit trail complete.

**Ready for the next change.**
