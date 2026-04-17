# Proposal: Purchases Forms UX — LCV indicator + CG/SERVICIO unification

## Intent

Bring `purchase-form.tsx` to full UX parity with the recently-shipped sales/dispatch forms. Today the "Registrar Libro de Compras" control lives in the bottom action bar (not a stateful header indicator), there is no way for an operator to UNLINK a purchase from the Libro de Compras once registered, and there is no reactivate path at all — the backend is literally missing `reactivatePurchase` at repo, service, and API-route layers. The Notas + Resumen de Pagos (CxP) layout also diverges from the sales pattern: Notas sits mid-form next to Descripción and the CxP summary stretches edge-to-edge. Additionally, `COMPRA_GENERAL` and `SERVICIO` are functionally identical in code (same lines, same validation, same journal build, same IVA linkage) — the only real split is two entry buttons and a filter label. This change ports the sales LCV/UX work verbatim and collapses the two entry points into one.

## Scope

### In Scope

**Sub-task A — LCV indicator + UX parity (ship first, independently deployable):**

- **A.1** Relocate the LCV control from the bottom action bar to Purchase header row 2 → `Proveedor | Total | LcvIndicator`.
- **A.2** LcvIndicator states mirror sales: S1 DRAFT → disabled/grey, S2 saved-unlinked → default "Registrar Libro de Compras" action, S3 saved-linked → green indicator opening edit/unlink menu.
- **A.3** New UNLINK flow: reuse the existing `IvaBooksService.voidPurchase(orgId, userId, id)` path (already wired to journal regeneration via `maybeRegenerateJournal`) behind a new "Desvincular del Libro de Compras" menu item in the S3 popover.
- **A.4** New REACTIVATE flow: create the missing backend — `IvaBooksRepository.reactivatePurchase`, `IvaBooksService.reactivatePurchase`, and `PATCH /api/organizations/[orgSlug]/iva-books/purchases/[id]/reactivate` — mirroring the existing `reactivateSale` implementation. Plus the matching `use-lcv-reactivate-purchase` hook and confirmation dialog.
- **A.5** Relocate `Notas (opcional)` to share a row with `Resumen de Pagos (CxP)` at the bottom of the form (mirrors sales `w-full` + `justify-between` + `text-right` pattern).
- **A.6** Right-align the "Resumen de Pagos (CxP)" payment detail rows using the same `flex justify-between items-start` block used in `sale-form.tsx`.

**Sub-task B — UI unification of `COMPRA_GENERAL` + `SERVICIO` (ship after A is stable):**

- **B.1** In `purchase-list.tsx`, replace the two buttons "Nueva Compra General" + "Nuevo Servicio" with a single "Nueva Compra / Servicio" button routing to `?type=COMPRA_GENERAL`.
- **B.2** Collapse the list filter options into a single "Compras y Servicios" entry that returns records matching either `COMPRA_GENERAL` or `SERVICIO`.
- **B.3** Unify display labels in the list and form headings — new purchases of this class are labelled "Compra / Servicio".

### Out of Scope

- **File/document upload field in "Resumen de Pagos"** — deferred to a separate future change (same call as made for sales).
- **Option C from the exploration (destructive data migration)** — explicitly rejected. `SERVICIO` stays in the `PurchaseType` Prisma enum; existing `SV-xxx` records remain readable and searchable; new records default to `COMPRA_GENERAL`. No Prisma migration, no rename of historical sequence numbers.
- Any change to `FLETE` or `POLLO_FAENADO` form flows, lines, validation, or journal paths.
- Any change to the `tipoCompra` numeric field (1–5) inside `IvaBookPurchaseModal`.
- Refactor of `IvaBookPurchaseModal` internals.

## Capabilities

### New Capabilities

- `IvaBooksRepository.reactivatePurchase(id, tx)` — flips an `IvaPurchaseBook` row from `VOIDED` back to `ACTIVE` (new method, missing today).
- `IvaBooksService.reactivatePurchase(orgId, userId, id)` — orchestrates reactivation + journal regeneration bridge (mirrors `reactivateSale`).
- `PATCH /api/organizations/[orgSlug]/iva-books/purchases/[id]/reactivate` — new API route (mirrors the existing sales reactivate route).

### Modified Capabilities

- `purchase-form-ui`: LCV control moves to header and becomes a 3-state indicator; Notas + Resumen de Pagos layout updated; unlink + reactivate become UI-invocable.
- `purchase-list-ui`: entry buttons and filter labels collapse COMPRA_GENERAL and SERVICIO into a single "Compra / Servicio" option.
- `iva-purchase-book-domain`: gains the `reactivate` complement to the existing `void` path.

## Approach

Reference implementation: the just-shipped `sales-dispatch-forms-ux` change. Every piece has a 1:1 analog already on disk — this proposal ports those pieces to the purchases domain.

The five concrete pieces:

1. **LcvIndicator (presentational)** — reuse the `<LcvIndicator status={S1|S2|S3} onRegister onEdit onUnlink />` component used in sales. Derive status from `(isEditMode, purchase, purchase.ivaPurchaseBook)` exactly as `deriveLcvState` does for sales. If the existing component's props aren't already domain-agnostic, generalize it rather than fork.
2. **Unlink hook + dialog** — new `use-lcv-unlink-purchase.ts` calls `PATCH .../iva-books/purchases/[id]/void` (route exists). New `unlink-lcv-confirm-dialog-purchase.tsx` — or reuse the sales dialog with a domain prop if props are generic enough.
3. **Reactivate hook + dialog + backend** — this is the only backend work in the change. Build the missing `reactivatePurchase` at all three layers (repo + service + route) strictly mirroring `reactivateSale`. Then wire a `use-lcv-reactivate-purchase.ts` hook and `reactivate-lcv-confirm-dialog-purchase.tsx` dialog from the S3 popover.
4. **Notas + Resumen de Pagos layout** — move Notas out of the mid-form grid-cols block and into the bottom row alongside the CxP summary. Restructure the CxP `<table>` into the sales `flex flex-col gap-1 w-full text-sm` pattern with `flex justify-between items-start` rows and `text-right` numeric column.
5. **Unification of CG + SERVICIO entry points** — `purchase-list.tsx`: merge the two "Nueva …" buttons into one, merge the two filter options into one, unify display label. `purchase-form.tsx` still accepts both `purchaseType` values (no prop change); new records created via the unified button pass `COMPRA_GENERAL`; existing `SV-xxx` records render exactly as before.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `components/purchases/purchase-form.tsx` | Modified | Header row 2 (LcvIndicator), remove footer LCV button, Notas relocation, CxP right-alignment |
| `components/purchases/purchase-list.tsx` | Modified | Merge CG + SERVICIO entry buttons + filter options + labels (Sub-task B) |
| `components/purchases/use-lcv-unlink-purchase.ts` | New | Hook wrapping the existing void endpoint |
| `components/purchases/unlink-lcv-confirm-dialog-purchase.tsx` | New (or reuse sales dialog) | Confirmation dialog for unlink |
| `components/purchases/use-lcv-reactivate-purchase.ts` | New | Hook wrapping the new reactivate endpoint |
| `components/purchases/reactivate-lcv-confirm-dialog-purchase.tsx` | New (or reuse sales dialog) | Confirmation dialog for reactivate |
| `app/api/organizations/[orgSlug]/iva-books/purchases/[id]/reactivate/route.ts` | New | `PATCH` route — mirrors sales reactivate route |
| `features/accounting/iva-books/iva-books.service.ts` | Modified | Add `reactivatePurchase(orgId, userId, id)` |
| `features/accounting/iva-books/iva-books.repository.ts` | Modified | Add `reactivatePurchase(id, tx)` |
| `components/sales/lcv-indicator.tsx` | Possibly generalized | Make domain-agnostic if its current API is sales-only |
| `components/purchases/__tests__/purchase-form-iva-gate.test.tsx` | Modified | Existing 4 tests rewired for header-location LcvIndicator |
| `features/purchase/__tests__/` | Added | Regression tests: unlink regenerates journal without IVA/IT; reactivate restores IVA/IT |
| `prisma/schema.prisma` | **None** | No enum change, no migration — SERVICIO stays |

## Non-Goals

- File/document upload field in CxP (deferred).
- Destructive Option C migration — SERVICIO stays in the enum, `SV-xxx` records stay readable, `CG-xxx` sequence is not rewritten.
- Any change to `FLETE` or `POLLO_FAENADO` flows, lines, validation, sequences, or journal paths.
- Change to `tipoCompra` numeric field semantics or the internals of `IvaBookPurchaseModal`.

## Open Questions

None. User has confirmed: (1) two sequential sub-tasks (A then B), (2) Option C rejected, (3) LCV here = Libro de Compras, (4) `reactivatePurchase` built at all three layers, (5) layout mirrors sales exactly.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Users confuse "Desvincular del Libro de Compras" with "Anular compra" | Med | Distinct copy + confirmation modal wording identical to the sales variant |
| Reactivate backend introduces a journal-regeneration regression | Med | Mirror `reactivateSale` 1:1; add targeted regression tests asserting IVA + IT lines return after reactivate |
| Existing `purchase-form-iva-gate.test.tsx` breaks on button relocation | High | Rewire the 4 tests in the same commit that moves the button; do not ship the move without updated tests |
| Sales `LcvIndicator` component may have sales-only types in its props | Low | Generalize to `LcvIndicator<T extends "sale" \| "purchase">` or equivalent discriminator; keep public surface identical |
| List filter merge regresses exports / reports that rely on separate filter values | Low | Filter merge is UI-only; underlying DB queries still accept `IN (COMPRA_GENERAL, SERVICIO)` and any external consumer keeps working |

## Rollback Plan

Sub-task A: pure UI + one new backend trio (repo/service/route). Revert the commit(s) to restore the bottom LCV button and old Notas/CxP layout; the new `reactivatePurchase` endpoint is additive and leaving it deployed is harmless.

Sub-task B: revert the `purchase-list.tsx` commit — the two "Nueva …" buttons and two filter options come back verbatim. `SERVICIO` records created in the interim (all entered via the merged button) will all be `COMPRA_GENERAL`, so no data rewrite is needed on rollback.

No DB migration on either sub-task, so no data transform to reverse.

## Dependencies

- Existing `IvaBooksService.voidPurchase(orgId, userId, id)` with journal-regeneration bridge (for unlink).
- Existing `reactivateSale` trio (repo + service + API route) as the implementation template for `reactivatePurchase`.
- Existing `isFiscalPeriodOpen` gate — reused for S2/S3 actions on the new LcvIndicator.
- Existing `LcvIndicator` component shipped in `sales-dispatch-forms-ux`.

## Success Criteria

- [ ] LCV state visible without scrolling in all three states (S1/S2/S3) on `purchase-form.tsx`.
- [ ] Operator can unlink a linked purchase; resulting journal entry contains NO IVA and NO IT lines.
- [ ] Operator can reactivate a previously-voided `IvaPurchaseBook` row; resulting journal entry restores IVA and IT lines.
- [ ] Original purchase row (amounts, lines, supplier) unchanged after unlink AND after reactivate.
- [ ] Notas and Resumen de Pagos share a single bottom row at `sm:` and up.
- [ ] CxP payment detail rows are right-aligned and visually tight (matches sales).
- [ ] `purchase-list.tsx` shows one "Nueva Compra / Servicio" button and one merged filter entry; historical `SV-xxx` records still render.
- [ ] `purchase-form-iva-gate.test.tsx` passes against the relocated LcvIndicator.
- [ ] Zero regressions in FLETE and POLLO_FAENADO flows.
