# Proposal: Sales & Dispatch Forms UX — LCV indicator + layout polish

## Intent

Operators lose the LCV (Libro de Ventas) vinculation state at a glance: today the "Registrar Libro de Ventas" control lives buried in the footer action bar next to destructive actions (Anular/Eliminar), and there is NO way to reverse a mistaken LCV registration. Additionally, `sale-form.tsx` and `dispatch-form.tsx` suffer from two layout pains — "Notas (opcional)" sitting mid-form next to "Descripción" is visually redundant, and the "Resumen de Cobros (CxC)" payment detail rows stretch edge-to-edge with a huge gap. This change makes LCV state a first-class stateful indicator in the header and tightens the visual grouping of the two forms.

## Scope

### In Scope

- **A.1** Relocate LCV control from footer to Sale header row 2 → `Cliente | Total | LCV indicator`.
- **A.2** LCV indicator states: S1 DRAFT → disabled/grey, S2 saved-unlinked → default action, S3 saved-linked → green + opens edit/unlink menu.
- **A.3** New UNLINK flow: void the `IvaSalesBook` and regenerate the sale journal entry WITHOUT IVA/IT lines — reuses `IvaBooksService.voidSale(orgId, userId, id)` which already triggers `maybeRegenerateJournal` (the non-IVA path in `buildSaleEntryLines` omits IVA + IT lines when no `ivaBookForEntry` is passed — engram #625).
- **A.4** Move `Notas (opcional)` to share a row with `Resumen de Cobros (CxC)` in `sale-form.tsx`.
- **A.5** Right-align the "Resumen de Cobros (CxC)" payment detail block in `sale-form.tsx`.
- **B.1** Move `Notas (opcional)` to share a row with `Resumen de Cobros` in `dispatch-form.tsx` for `NOTA_DE_DESPACHO` and `BOLETA_CERRADA` variants.
- **B.2** Right-align the "Resumen de Cobros" payment detail block in `dispatch-form.tsx`.

### Out of Scope

- File/document upload field in "Resumen de Cobros" (deferred — separate future change).
- Any LCV logic for dispatches (dispatches do NOT link to `IvaSalesBook`).
- Changes to the third dispatch variant beyond NDD / BC.
- Refactor of the existing IVA modal internals.

## Capabilities

### New Capabilities

- None. Unlink reuses `voidSale` + existing journal regeneration bridge.

### Modified Capabilities

- `sale-form-ui`: LCV control relocates to header and becomes a 3-state indicator; Notas + Resumen Cobros layout updated. Unlink-from-LCV becomes a UI-invocable action.
- `dispatch-form-ui`: Notas + Resumen Cobros layout updated for NDD and BC variants.

## Approach

- **LCV indicator** → extract into a small presentational component `<LcvIndicator status={S1|S2|S3} onRegister onEdit onUnlink />`; derive status from `(isEditMode, sale, sale.ivaSalesBook)`.
- **Unlink** → wire the existing server action that backs the IVA modal's void path (`IvaBooksService.voidSale(orgId, userId, id)`) to a new "Desvincular del Libro de Ventas" menu item inside the S3 popover. The bridge in `voidSale` already calls `maybeRegenerateJournal("sale", saleId, ...)` which, with no linked active IvaBook, re-emits journal lines via `buildSaleEntryLines` WITHOUT IVA/IT (engram #625 regression baseline).
- **Layout** → swap grid-cols for the Notas row and restructure the Resumen Cobros table to a right-aligned column using `ml-auto` / `flex justify-end` on the payment detail rows.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `components/sales/sale-form.tsx` | Modified | Header row 2, remove footer LCV button, Notas relocation, Resumen Cobros alignment |
| `components/dispatches/dispatch-form.tsx` | Modified | Notas relocation + Resumen Cobros alignment (NDD, BC only) |
| `components/sales/lcv-indicator.tsx` | New | Stateful LCV control (S1/S2/S3) |
| `features/accounting/iva-books/` | None (reuse) | `voidSale` already supports regenerate-without-IVA |
| `features/sale/__tests__/` | Modified | Add regression: unlink path regenerates journal without IVA/IT lines |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Unlink confused with "Anular venta" | Med | Distinct copy: "Desvincular del Libro de Ventas" + confirmation modal explaining the sale is preserved |
| Journal regeneration failure leaves orphan state | Low | `voidSale` runs inside a transaction; existing bridge already handles rollback |
| S3 green styling clashes with "Guardar y contabilizar" green | Low | Use a distinct tone (emerald-50 background, emerald-700 border) — not the CTA green |
| Layout shift on small viewports when Notas shares row with Resumen | Med | Grid collapses to single column below `sm:` breakpoint |

## Rollback Plan

Pure UI + reuse-existing-service change. Revert the commit(s): the removed footer LCV button and old Notas/Resumen layout are restored verbatim; `voidSale` is untouched. No DB migration, no data transform.

## Dependencies

- Existing `IvaBooksService.voidSale(orgId, userId, id)` with journal-regeneration bridge (engram #625, #627).
- Existing `isFiscalPeriodOpen` gate — reused for S2/S3 actions.

## Success Criteria

- [ ] LCV state is visible without scrolling to footer in all three states (S1/S2/S3).
- [ ] User can unlink a linked sale and the resulting journal entry contains NO IVA and NO IT lines.
- [ ] Original sale row (amounts, lines, contact) is unchanged after unlink.
- [ ] Notas and Resumen Cobros share a single row at `sm:` and up in both forms.
- [ ] Payment detail rows inside Resumen Cobros are right-aligned and visually tight.
- [ ] Zero regressions in existing IVA register/edit flow (S2 path still opens the current modal).
