# Tasks: Sales & Dispatch Forms UX — LCV indicator + layout polish

## PR1: LcvIndicator component + state machine

- [x] T1.1 RED (REQ-A.2) — Create `components/sales/__tests__/lcv-indicator.test.tsx`: assert S1 renders disabled/grey, no click handler fires. Deps: none.
- [x] T1.2 GREEN (REQ-A.2) — Create `components/sales/lcv-indicator.tsx` with `LcvIndicatorProps = { state: "S1"|"S2"|"S3", periodOpen: boolean, onRegister?, onEdit?, onUnlink? }`. S1 passes. AC: T1.1 green + `tsc --noEmit` clean.
- [x] T1.3 RED (REQ-A.2) — Extend test: S2 renders clickable neutral button; click calls `onRegister`; `periodOpen=false` disables it.
- [x] T1.4 GREEN (REQ-A.2) — Implement S2 branch in `lcv-indicator.tsx`. AC: T1.3 green.
- [x] T1.5 RED (REQ-A.2) — Extend test: S3 renders `bg-emerald-50 border-emerald-600` button; click opens `DropdownMenu`; items "Editar registro LCV" and "Desvincular del Libro de Ventas" visible.
- [x] T1.6 GREEN (REQ-A.2) — Implement S3 branch using `dropdown-menu.tsx`. AC: T1.5 green.
- [x] T1.7 REFACTOR — Extract state-to-classes mapping to a pure function; no logic in JSX conditionals. AC: tests still green + tsc clean.

## PR2: UnlinkLcvConfirmDialog + unlink handler

- [ ] T2.1 RED (REQ-A.3) — Create `components/sales/__tests__/unlink-lcv-confirm-dialog.test.tsx`: assert copy does NOT contain "Anular"; "Confirmar" calls `onConfirm`; "Cancelar" calls `onCancel` without side effects.
- [ ] T2.2 GREEN (REQ-A.3) — Create `components/sales/unlink-lcv-confirm-dialog.tsx` mirroring `confirm-trim-dialog.tsx` pattern (wraps `dialog.tsx`). Copy: "La venta se conserva. El asiento contable se regenera sin IVA ni IT." AC: T2.1 green.
- [ ] T2.3 RED (REQ-A.3) — Create `components/sales/__tests__/sale-form-unlink-flow.test.tsx`: mock `fetch` to `PATCH /api/…/iva-books/sales/{ivaBookId}/void`; assert URL uses `sale.ivaSalesBook.id` (NOT `sale.id`); assert revalidation (`router.refresh`) called on success.
- [ ] T2.4 GREEN (REQ-A.3) — Add `handleUnlinkLcv(ivaBookId: string)` in `sale-form.tsx` calling `PATCH` endpoint; wire to `UnlinkLcvConfirmDialog` `onConfirm`. AC: T2.3 green.
- [ ] T2.5 RED (REQ-A.3) — Extend `features/accounting/iva-books/__tests__/iva-books.service.cascade.test.ts`: "unlink then read journal — no IVA lines, no IT lines, sale unchanged".
- [ ] T2.6 GREEN (REQ-A.3) — Verify `IvaBooksService.voidSale` + `maybeRegenerateJournal` already satisfies (likely no code change). AC: T2.5 green.

## PR3: Sale form header row 2 + footer cleanup

- [ ] T3.1 RED (REQ-A.1) — Extend `components/sales/__tests__/sale-form-iva-gate.test.tsx` (or new file): saved sale renders `<LcvIndicator>` in header row 2 alongside Cliente and Total.
- [ ] T3.2 GREEN (REQ-A.1) — In `sale-form.tsx` line ~597: add third column to `grid-cols-2` row → `sm:grid-cols-3`; insert `<LcvIndicator>` with derived state `(isEditMode, sale?.id, sale?.ivaSalesBook)`. Wire `onRegister → setIvaModalOpen(true)`, `onEdit → setIvaModalOpen(true)`, `onUnlink → setUnlinkDialogOpen(true)`. AC: T3.1 green.
- [ ] T3.3 RED (REQ-A.1/removal) — Test: footer does NOT render "Registrar Libro de Ventas" button in any state.
- [ ] T3.4 GREEN (REQ-A.1/removal) — Remove block `lines 873–887` from `sale-form.tsx`. AC: T3.3 green + tsc clean.

## PR4: Notas + Resumen layout (sale-form)

- [ ] T4.1 RED (REQ-A.4) — Test: Notas renders inside `grid grid-cols-1 sm:grid-cols-2` row (assert CSS class or sibling element Resumen de Cobros).
- [ ] T4.2 GREEN (REQ-A.4) — In `sale-form.tsx` lines ~635–659: move Notas textarea out of standalone `grid-cols-1` div; create new bottom `grid grid-cols-1 sm:grid-cols-2 gap-4` row containing Notas (left) + Resumen de Cobros slot (right). AC: T4.1 green.
- [ ] T4.3 RED (REQ-A.4 DRAFT) — Test: when `sale.receivable` is null, Notas container still renders inside the 2-col grid; right slot is empty (no Resumen card). Grid structure preserved.
- [ ] T4.4 GREEN (REQ-A.4 DRAFT) — Conditionally render Resumen card in right slot; left (Notas) always present. AC: T4.3 green.
- [ ] T4.5 RED (REQ-A.5) — Test: Resumen de Cobros payment rows container has class `ml-auto` or `flex justify-end` (assert on wrapper div).
- [ ] T4.6 GREEN (REQ-A.5) — In `sale-form.tsx` lines ~807–853: replace `<table className="w-full">` with `<div className="flex flex-col gap-1 ml-auto w-fit">` rows using `flex justify-between gap-4`. AC: T4.5 green.
- [ ] T4.7 RED (REQ-A.4) — Test: grid collapses to 1 col below `sm:` (assert `grid-cols-1` present, `sm:grid-cols-2` present).
- [ ] T4.8 GREEN (REQ-A.4) — Confirm responsive classes applied in T4.2 green step already satisfy. AC: T4.7 green.

## PR5: Notas + Resumen layout (dispatch-form NDD + BC)

- [ ] T5.1 RED (REQ-B.1) — Create `components/dispatches/__tests__/dispatch-form-layout.test.tsx`: NDD variant — Notas shares row with Resumen (assert grid class on wrapper).
- [ ] T5.2 GREEN (REQ-B.1) — In `dispatch-form.tsx` lines ~967–1012: replace standalone `grid-cols-1` Notas row with `grid grid-cols-1 sm:grid-cols-2 gap-4` containing Notas + Resumen slot. AC: T5.1 green.
- [ ] T5.3 RED (REQ-B.2) — Extend test: BC variant same assertion as T5.1.
- [ ] T5.4 GREEN (REQ-B.2) — Verify same grid change already covers BC (same component path); add BC-specific render test if branching differs. AC: T5.3 green.
- [ ] T5.5 RED (REQ-B.3) — Test: dispatch Resumen de Cobros rows wrapper has `ml-auto` / `flex justify-end` (both NDD and BC).
- [ ] T5.6 GREEN (REQ-B.3) — In `dispatch-form.tsx` lines ~1418–1470: replace `<table className="w-full">` in Resumen block with `<div className="flex flex-col gap-1 ml-auto w-fit">` rows. AC: T5.5 green.
- [ ] T5.7 RED (REQ-B.1/B.2) — Test: responsive collapse — `grid-cols-1` + `sm:grid-cols-2` classes present on Notas/Resumen wrapper.
- [ ] T5.8 GREEN (REQ-B.1/B.2) — Confirm T5.2 green step already applies responsive classes; adjust if needed. AC: T5.7 green.

## PR6: Type check + full test run + commits

- [ ] T6.1 — Run `pnpm tsc --noEmit`; fix any type errors introduced by new props/components.
- [ ] T6.2 — Run `pnpm vitest run`; all tests must be green (no regressions).
- [ ] T6.3 — Conventional commits per PR grouping: `feat(lcv-indicator): …`, `feat(sale-form): …`, `feat(dispatch-form): …`. No Co-Authored-By.
