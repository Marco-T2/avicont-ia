# Tasks: Purchases Forms UX — LCV indicator + CG/SERVICIO unification

## PR1: Move LcvIndicator to common (D.1)

- [x] T1.1 RED (REQ-A.2) — Create `components/common/__tests__/lcv-indicator.test.tsx`: copy the existing sales test file verbatim; update import path to `@/components/common/lcv-indicator`; assert tests still reference S1/S2/S3 states correctly. Verify RED by running against current path. Deps: none.
- [x] T1.2 GREEN (REQ-A.2) — Move `components/sales/lcv-indicator.tsx` → `components/common/lcv-indicator.tsx`; update import in `components/sales/sale-form.tsx` to `@/components/common/lcv-indicator`; delete the old file. AC: T1.1 green + `tsc --noEmit` clean + existing sales tests still pass. Deps: T1.1.

## PR2: `reactivatePurchase` backend trio (REQ-B.1, B.2, B.3)

- [x] T2.1 RED (REQ-B.2) — In `features/accounting/iva-books/__tests__/reactivate-purchase.test.ts`: write repo tests — (a) VOIDED → ACTIVE succeeds + DTO returned; (b) NotFoundError when id missing; (c) ConflictError when status is already ACTIVE; (d) `estadoSIN` untouched. Mock Prisma client. Deps: none.
- [x] T2.2 GREEN (REQ-B.2) — Add `reactivatePurchase(orgId: string, id: string): Promise<IvaPurchaseBookDTO>` to `features/accounting/iva-books/iva-books.repository.ts`; mirror `reactivateSale` at lines 427-445; use `toPurchaseDTO(row)`; no `estadoSIN` update. AC: T2.1 green. Deps: T2.1.
- [x] T2.3 RED (REQ-B.1) — In same test file: add service tests — (a) delegates to `repo.reactivatePurchase(orgId, id)` and calls `maybeRegenerateJournal("purchase", purchaseId, orgId, userId)` once on success; (b) ConflictError propagated without calling `maybeRegenerateJournal`; (c) period CLOSED → `FISCAL_PERIOD_CLOSED` thrown. Deps: T2.2.
- [x] T2.4 GREEN (REQ-B.1) — Add `reactivatePurchase(orgId: string, userId: string, id: string): Promise<IvaPurchaseBookDTO>` to `features/accounting/iva-books/iva-books.service.ts`; call `repo.reactivatePurchase`; on success call `maybeRegenerateJournal("purchase", result.purchaseId, orgId, userId)`; return result. AC: T2.3 green. Deps: T2.3.
- [x] T2.5 RED (REQ-B.3) — Create `app/api/organizations/[orgSlug]/iva-books/purchases/[id]/reactivate/__tests__/route.test.ts`: test (a) 200 + DTO on success; (b) 404 when NotFoundError; (c) 409 when ConflictError; (d) 401 unauthenticated; (e) 403 wrong role. Use Next.js route-handler test pattern — `await PATCH(req, { params: Promise.resolve({ orgSlug, id }) })`. Deps: T2.4.
- [x] T2.6 GREEN (REQ-B.3) — Create `app/api/organizations/[orgSlug]/iva-books/purchases/[id]/reactivate/route.ts`; mirror `app/api/organizations/[orgSlug]/iva-books/purchases/[id]/void/route.ts` pattern; `params` typed as `Promise<{ orgSlug: string; id: string }>` and awaited (Next.js 16 async params); call `service.reactivatePurchase(orgId, userId, id)`; return `Response.json(entry)` on 200; `handleError(error)` for all others. Wire `IvaBooksService` instance with `IvaBooksRepository`, `SaleService`, `PurchaseService` (same as void route). AC: T2.5 green + `tsc --noEmit` clean. Deps: T2.5.

## PR3: Purchase form — LcvIndicator in header row 2 (REQ-A.1, A.2)

- [x] T3.1 RED (REQ-A.1, A.2) — Create `components/purchases/__tests__/purchase-form-lcv-header.test.tsx`: (a) new purchase (no id) → LcvIndicator renders with `data-lcv-state="S1"`; (b) saved purchase, no `ivaPurchaseBook` → `data-lcv-state="S2"`; (c) saved purchase, `ivaPurchaseBook.status === "ACTIVE"` → `data-lcv-state="S3"` with emerald classes; (d) saved purchase, `ivaPurchaseBook.status === "VOIDED"` → `data-lcv-state="S2"` (treated as unregistered); (e) header row 2 has `sm:grid-cols-3` (or equivalent 3-slot layout). Deps: T1.2.
- [x] T3.2 GREEN (REQ-A.1, A.2) — In `components/purchases/purchase-form.tsx`: import `LcvIndicator` and `LcvState` from `@/components/common/lcv-indicator`; add local `deriveLcvStatePurchase` helper (S1 when no purchase or DRAFT, S2 when no ivaPurchaseBook or VOIDED, S3 when ACTIVE); add `[unlinkDialogOpen, setUnlinkDialogOpen]` + `[reactivateDialogOpen, setReactivateDialogOpen]` state; wire `useLcvUnlinkPurchase` + `useLcvReactivatePurchase` stubs (hooks created in PR4/PR5); render `<LcvIndicator>` in header row 2 slot with `onRegister/onEdit/onUnlink` callbacks; remove footer LCV button block at lines 1453-1467. Fix latent modal bug (D.9): set `mode` to `"edit"` only when `ivaPurchaseBook?.status !== "VOIDED"`, otherwise `"create-from-source"`; set `entryId` to `undefined` when VOIDED. AC: T3.1 green. Deps: T3.1.
- [x] T3.3 RED (REQ-A.1 removal) — In `components/purchases/__tests__/purchase-form-iva-gate.test.tsx`: rewire the 4 existing tests that query `getByRole("button", { name: /registrar libro de compras/i })` (footer) to instead query the header LcvIndicator via `data-lcv-state` attribute; assert footer does NOT contain a "Registrar Libro de Compras" button. Confirm RED on current code. Deps: T3.2.
- [x] T3.4 GREEN (REQ-A.1 removal) — The footer button was already removed in T3.2; this task confirms all 4 rewired gate tests pass + zero regressions in the full test suite (`pnpm vitest run`). AC: T3.3 green + all prior tests still passing. Deps: T3.3.

## PR4: Unlink flow (REQ-A.3)

- [x] T4.1 RED (REQ-A.3) — Create `components/purchases/__tests__/unlink-lcv-confirm-dialog-purchase.test.tsx`: (a) title renders "Desvincular del Libro de Compras"; (b) body copy does NOT contain the word "Anular"; (c) body explicitly mentions the purchase is preserved; (d) primary button "Desvincular" calls `onConfirm`; (e) "Cancelar" calls `onOpenChange(false)` without calling `onConfirm`. Use `fireEvent.pointerDown + click` for Radix triggers. Deps: none.
- [x] T4.2 GREEN (REQ-A.3) — Create `components/purchases/unlink-lcv-confirm-dialog-purchase.tsx`; use shadcn `dialog` primitive; Props: `{ open, onOpenChange, onConfirm, isPending? }`; copy per D.7: title "Desvincular del Libro de Compras", body "No se elimina la compra — solo se elimina el vínculo con el LCV. La compra se conserva intacta. El asiento contable se regenera sin IVA ni IT. ¿Confirmás?"; primary Button variant="destructive" label "Desvincular"; no `alert-dialog` (per shadcn constraint). AC: T4.1 green. Deps: T4.1.
- [x] T4.3 RED (REQ-A.3) — Create `components/purchases/__tests__/use-lcv-unlink-purchase.test.tsx`: (a) `handleUnlink` calls `fetch` with `PATCH` to `/api/organizations/${orgSlug}/iva-books/purchases/${ivaBookId}/void` (URL uses `ivaBookId`, NOT `purchaseId`); (b) on 200 calls `router.refresh()` + `toast.success`; (c) on error response calls `toast.error`; (d) when `ivaBookId` is undefined, no fetch call made. Deps: T4.2.
- [x] T4.4 GREEN (REQ-A.3) — Create `components/purchases/use-lcv-unlink-purchase.ts`; mirror D.5 shape: `useLcvUnlinkPurchase(orgSlug, ivaBookId)`; `"use client"`; `fetch PATCH`; `toast.success("Compra desvinculada del LCV")`; `router.refresh()`; `toast.error` on failure; returns `{ handleUnlink, isPending }`. AC: T4.3 green. Deps: T4.3.
- [x] T4.5 GREEN (REQ-A.3) — Wire `UnlinkLcvConfirmDialogPurchase` + `useLcvUnlinkPurchase` into `purchase-form.tsx` (imports + dialog render near modal bottom of JSX tree); `onConfirm` calls `handleUnlink()` then closes dialog on resolve. This completes the unlink flow end-to-end in the form. AC: T3.2 hook stubs replaced with real hooks + dialog visible. Deps: T4.4, T3.2.

## PR5: Reactivate flow (REQ-A.4)

- [x] T5.1 RED (REQ-A.4) — Create `components/purchases/__tests__/reactivate-lcv-confirm-dialog-purchase.test.tsx`: (a) title "Reactivar registro en el Libro de Compras"; (b) body mentions LCV registration will be restored and journal updated; (c) primary "Reactivar" button (default variant) calls `onConfirm`; (d) "Cancelar" closes without calling `onConfirm`. Deps: none.
- [x] T5.2 GREEN (REQ-A.4) — Create `components/purchases/reactivate-lcv-confirm-dialog-purchase.tsx`; shadcn `dialog`; Props: `{ open, onOpenChange, onConfirm, isPending? }`; copy per D.7: title "Reactivar registro en el Libro de Compras", body "Se reactivará el registro anterior del LCV y el comprobante se regenerará con IVA e IT. ¿Confirmás?"; primary Button default variant "Reactivar". AC: T5.1 green. Deps: T5.1.
- [x] T5.3 RED (REQ-A.4) — Create `components/purchases/__tests__/use-lcv-reactivate-purchase.test.tsx`: (a) `handleReactivate` calls `fetch` `PATCH` to `.../iva-books/purchases/${ivaBookId}/reactivate`; (b) on 200 calls `router.refresh()` + `toast.success("Compra reactivada en el LCV")`; (c) on error calls `toast.error`; (d) undefined `ivaBookId` → no fetch. Deps: T5.2.
- [x] T5.4 GREEN (REQ-A.4) — Create `components/purchases/use-lcv-reactivate-purchase.ts`; mirror D.6 shape: `useLcvReactivatePurchase(orgSlug, ivaBookId)`; `"use client"`; returns `{ handleReactivate, isPending }`. AC: T5.3 green. Deps: T5.3.
- [x] T5.5 RED (REQ-A.4) — Extend `components/purchases/__tests__/purchase-form-lcv-header.test.tsx`: (a) purchase with `ivaPurchaseBook.status === "VOIDED"` + click on S2 indicator → `reactivateDialogOpen` state set (assert `ReactivateLcvConfirmDialogPurchase` becomes visible); (b) purchase with no `ivaPurchaseBook` + click → modal opens (not reactivate dialog); (c) S3 dropdown "Desvincular del LCV" → `unlinkDialogOpen` state set. Deps: T5.4, T3.2.
- [x] T5.6 GREEN (REQ-A.4) — Wire `ReactivateLcvConfirmDialogPurchase` + `useLcvReactivatePurchase` into `purchase-form.tsx`; replace stubs from T3.2; ensure `onRegister` callback in `LcvIndicator` correctly branches: `ivaPurchaseBook.status === "VOIDED"` → `setReactivateDialogOpen(true)`, else → `setIvaModalOpen(true)`. AC: T5.5 green + no regressions. Deps: T5.5.

## PR6: Notas + CxP layout — bottom row (REQ-A.5, A.6)

- [x] T6.1 RED (REQ-A.5) — Create `components/purchases/__tests__/purchase-form-bottom-row.test.tsx`: (a) wrapper div with `data-testid="bottom-row"` exists; (b) it has classes `grid grid-cols-1 sm:grid-cols-2`; (c) Notas textarea is a child of `bottom-row`; (d) "Resumen de Pagos" heading is a child of `bottom-row` when `purchase.payable != null`; (e) when `purchase.payable` is null the left Notas slot still renders and `bottom-row` is still present. Deps: T3.2.
- [x] T6.2 GREEN (REQ-A.5) — In `purchase-form.tsx`: remove `Notas (opcional)` block from mid-form position (lines 887-898); remove old standalone CxP `<Card>` (lines 1387-1433); insert new `<div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="bottom-row">` after the details table and before the actions row; left slot = Notas `<Textarea>`; right slot = Resumen de Pagos `<Card>` (conditional on `purchase?.payable != null && (status === "POSTED" || status === "LOCKED")`) or empty `<div />`. AC: T6.1 green. Deps: T6.1.
- [x] T6.3 RED (REQ-A.6) — Extend `purchase-form-bottom-row.test.tsx`: (a) Resumen de Pagos inner container has class `flex flex-col gap-1 w-full`; (b) each payment row div has classes `flex justify-between items-start`; (c) amount span has `text-right` class; (d) amount span has `whitespace-nowrap` class. Deps: T6.2.
- [x] T6.4 GREEN (REQ-A.6) — In `purchase-form.tsx` CxP right slot: replace `<table className="w-full text-sm">` with `<div className="flex flex-col gap-1 w-full text-sm">`; each row becomes `<div className="flex justify-between items-start gap-4 ...">` per D.10 pattern; amount spans carry `font-mono text-right whitespace-nowrap`; header row `border-b pb-2 font-semibold`; balance row `border-t-2 pt-2 font-bold`. AC: T6.3 green + `tsc --noEmit` clean. Deps: T6.3.

## PR7: Purchase list unification — entry button + filter (REQ-C.1, C.2)

- [x] T7.1 RED (REQ-C.1) — Create `components/purchases/__tests__/purchase-list-unification.test.tsx`: (a) exactly ONE entry button/link with text matching `/nueva compra \/ servicio/i` is rendered; (b) NO button/link with text matching `/nueva compra general/i` or `/nuevo servicio/i`; (c) the unified button's `href` contains `?type=COMPRA_GENERAL`; (d) existing `SV-xxx` rows render in the list when data includes `SERVICIO`-type purchases. Deps: none.
- [x] T7.2 GREEN (REQ-C.1) — In `components/purchases/purchase-list.tsx`: remove "Compra General" and "Servicio" entry `<Card>` blocks (lines 218-260); replace with a single `<Card>` "Compra / Servicio" whose `<Link>` routes to `/${orgSlug}/purchases/new?type=COMPRA_GENERAL`; update card grid from `grid-cols-2 lg:grid-cols-4` to `grid-cols-1 sm:grid-cols-3` (3 cards: Flete, Pollo Faenado, Compra/Servicio) per D.11. AC: T7.1 a/b/c green. Deps: T7.1.
- [x] T7.3 RED (REQ-C.2) — Extend `purchase-list-unification.test.tsx`: (a) filter `<SelectContent>` contains ONE item covering both types: value `"COMPRA_GENERAL_O_SERVICIO"` with label "Compras y Servicios"; (b) NO separate items with value `"COMPRA_GENERAL"` or `"SERVICIO"`; (c) selecting `"COMPRA_GENERAL_O_SERVICIO"` filter shows both `COMPRA_GENERAL` and `SERVICIO` records; (d) selecting `"FLETE"` shows only FLETE records; (e) `PURCHASE_TYPE_LABEL["COMPRA_GENERAL"]` and `PURCHASE_TYPE_LABEL["SERVICIO"]` both map to `"Compra / Servicio"`. Deps: T7.2.
- [x] T7.4 GREEN (REQ-C.2) — In `purchase-list.tsx`: replace the two `<SelectItem value="COMPRA_GENERAL">` and `<SelectItem value="SERVICIO">` with `<SelectItem value="COMPRA_GENERAL_O_SERVICIO">Compras y Servicios</SelectItem>`; update filter predicate to handle `"COMPRA_GENERAL_O_SERVICIO"` as OR of both types (per D.11); update `PURCHASE_TYPE_LABEL` to map both `COMPRA_GENERAL` and `SERVICIO` to `"Compra / Servicio"`. AC: T7.3 green + `tsc --noEmit` clean + all tests pass. Deps: T7.3.

## PR8: Regression tests — journal regeneration (REQ-A.3, A.4, B.1)

- [x] T8.1 RED (REQ-A.3) — Create `features/purchase/__tests__/unlink-regenerates-journal.test.ts`: assert that after `IvaBooksService.voidPurchase(orgId, userId, ivaBookId)` the mock `regenerateJournalForIvaChange` is called once AND the resulting journal entry contains NO lines of type `IVA` or `IT`. Mirror `iva-books.service.cascade.test.ts` sales equivalent. Deps: T2.2.
- [x] T8.2 GREEN (REQ-A.3) — Verify the existing `voidPurchase` path already satisfies T8.1 (no new code needed — cascade bridge already wired). AC: T8.1 green. Deps: T8.1.
- [x] T8.3 RED (REQ-A.4, B.1) — Create `features/purchase/__tests__/reactivate-regenerates-journal.test.ts`: assert that after `IvaBooksService.reactivatePurchase(orgId, userId, ivaBookId)` the mock `regenerateJournalForIvaChange` is called once AND the resulting journal entry contains IVA lines AND IT lines. Deps: T2.4.
- [x] T8.4 GREEN (REQ-A.4, B.1) — Confirm the `reactivatePurchase` service added in T2.4 triggers journal regen correctly; add any fixture adjustments needed to make journal lines visible in the test. AC: T8.3 green. Deps: T8.3.

---

## Coverage Matrix

| REQ | Task(s) with RED coverage | Covered? |
|-----|--------------------------|----------|
| REQ-A.1 | T3.1, T3.3 | ✅ |
| REQ-A.2 | T1.1, T3.1 | ✅ |
| REQ-A.3 | T4.1, T4.3, T8.1 | ✅ |
| REQ-A.4 | T5.1, T5.3, T5.5, T8.3 | ✅ |
| REQ-A.5 | T6.1 | ✅ |
| REQ-A.6 | T6.3 | ✅ |
| REQ-B.1 | T2.3, T8.3 | ✅ |
| REQ-B.2 | T2.1 | ✅ |
| REQ-B.3 | T2.5 | ✅ |
| REQ-C.1 | T7.1 | ✅ |
| REQ-C.2 | T7.3 | ✅ |

All 11 requirements (REQ-A.1 through REQ-C.2) have at least one RED task. **Coverage complete — no gaps.**
