# Archive Report: Purchases Forms UX — LCV indicator + CG/SERVICIO unification

**Change**: `purchases-forms-ux`  
**Archived**: 2026-04-17  
**Status**: CLOSED — PASS  
**Verdict**: All 11 REQs compliant, 820/820 tests passing, 0 critical issues.

---

## Intent & Scope

### What Was Built

A UX improvement cycle for purchase forms, bringing them to full parity with the recently-shipped sales/dispatch forms:

1. **LCV vinculation visibility**: Moved the "Registrar Libro de Compras" control from the bottom action bar into the form header as a stateful 3-state indicator (S1 draft/locked, S2 unlinked/actionable, S3 linked/green).
2. **Unlink + Reactivate paths**: Added the missing backend infrastructure (`reactivatePurchase` at repo/service/API route layers) and paired it with UI flows for unlinking and reactivating purchases in the Libro de Compras.
3. **Layout improvements**: Relocated the Notas field to share a bottom row with Resumen de Pagos, and right-aligned the CxP payment detail rows using the flex pattern from sale-form.
4. **Entry-point unification**: Merged the separate "Nueva Compra General" and "Nuevo Servicio" entry buttons into a single "Compra / Servicio" button and list filter, collapsing two functionally-identical UI paths into one.

### What Shipped

- **Purchase form header**: LCV indicator (S1/S2/S3) in row 2 alongside Proveedor and Total.
- **Unlink flow**: S3 popover menu item "Desvincular del LCV" → confirmation dialog → PATCH void endpoint → journal regenerated without IVA/IT lines.
- **Reactivate flow**: S2 click (when VOIDED) or S3 menu item → confirmation dialog → PATCH reactivate endpoint → journal regenerated with IVA/IT lines.
- **Layout (Notas + Resumen)**: Bottom row, side-by-side at `sm:` and above, single-column below; payment rows right-aligned via `flex justify-between items-start`.
- **List unification**: One "Compra / Servicio" entry button + unified "Compras y Servicios" filter; historical `SV-xxx` records remain visible and searchable.

---

## Capabilities Modified

### purchase-form-ui
- **LCV Indicator (S1/S2/S3)**:
  - S1 (draft): Grey, disabled — no interaction.
  - S2 (saved, no IvaPurchaseBook or VOIDED): Neutral — click opens register-in-LCV modal.
  - S3 (saved, linked, ACTIVE): Emerald (distinct from CTA green) — click reveals Edit + Unlink popover.
- **Unlink Flow**: Void IvaPurchaseBook + regenerate purchase journal WITHOUT IVA/IT lines. Reuses existing `PATCH /api/iva-books/purchases/[id]/void` endpoint.
- **Reactivate Flow**: Reactivate IvaPurchaseBook + regenerate purchase journal WITH IVA/IT lines. New `PATCH /api/iva-books/purchases/[id]/reactivate` endpoint.
- **Layout (Notas + Resumen)**: Bottom row, side-by-side at `sm:` and above, single-column below.
- **Resumen Right-Alignment**: Payment detail rows flush right via `flex justify-between items-start gap-4` with `text-right whitespace-nowrap` amounts.
- **Removed**: "Registrar Libro de Compras" footer button (replaced by header indicator).

### iva-purchase-book-domain
- **`reactivatePurchase` Service Method**: Orchestrates reactivation + journal regeneration bridge (mirrors `reactivateSale`).
- **`reactivatePurchase` Repository Method**: Flips `IvaPurchaseBook` status from `VOIDED` back to `ACTIVE`.
- **PATCH reactivate Route**: New `app/api/organizations/[orgSlug]/iva-books/purchases/[id]/reactivate/route.ts` endpoint.

### purchase-list-ui
- **Unified Entry Button**: Single "Compra / Servicio" button routing to `?type=COMPRA_GENERAL`; no schema change.
- **Unified Filter**: Collapsed "Compra General" + "Servicios" into single "Compras y Servicios" filter option.
- **FLETE + POLLO_FAENADO**: Unchanged; remain separate entry buttons and filter options.

---

## Files Touched

### Moved
- `components/sales/lcv-indicator.tsx` → `components/common/lcv-indicator.tsx` (shared across sales and purchases)

### New Components
- `components/purchases/use-lcv-unlink-purchase.ts` — Hook for unlink mutation.
- `components/purchases/unlink-lcv-confirm-dialog-purchase.tsx` — Confirmation dialog wrapper.
- `components/purchases/use-lcv-reactivate-purchase.ts` — Hook for reactivate mutation.
- `components/purchases/reactivate-lcv-confirm-dialog-purchase.tsx` — Confirmation dialog wrapper.

### New Tests
- `components/purchases/__tests__/purchase-form-lcv-header.test.tsx` — LCV S1/S2/S3 rendering + interaction.
- `components/purchases/__tests__/unlink-lcv-confirm-dialog-purchase.test.tsx` — Unlink confirmation flow.
- `components/purchases/__tests__/reactivate-lcv-confirm-dialog-purchase.test.tsx` — Reactivate confirmation flow.
- `components/purchases/__tests__/use-lcv-unlink-purchase.test.ts` — Unlink hook integration.
- `components/purchases/__tests__/use-lcv-reactivate-purchase.test.ts` — Reactivate hook integration.
- `components/purchases/__tests__/purchase-form-bottom-row.test.tsx` — Notas + Resumen layout.
- `components/purchases/__tests__/purchase-list-unification.test.tsx` — Entry button + filter unification.
- `features/purchase/__tests__/unlink-regenerates-journal.test.ts` — Void → journal cascade.
- `features/purchase/__tests__/reactivate-regenerates-journal.test.ts` — Reactivate → journal cascade.
- `app/api/organizations/[orgSlug]/iva-books/purchases/[id]/reactivate/__tests__/route.test.ts` — Endpoint integration.

### Modified Components
- `components/purchases/purchase-form.tsx` — LCV indicator in row 2, footer button removal, Notas/Resumen relocation, VOIDED modal fix, unlink/reactivate handler wiring.
- `components/purchases/purchase-list.tsx` — Merge CG + SERVICIO entry buttons and filter options.
- `components/sales/sale-form.tsx` — Updated import from `components/common/lcv-indicator`.

### New Backend
- `app/api/organizations/[orgSlug]/iva-books/purchases/[id]/reactivate/route.ts` — PATCH endpoint.
- `features/accounting/iva-books/iva-books.service.ts` (+`reactivatePurchase` method).
- `features/accounting/iva-books/iva-books.repository.ts` (+`reactivatePurchase` method).

### Modified Tests
- `components/purchases/__tests__/purchase-form-iva-gate.test.tsx` — Rewired from footer button to header LcvIndicator.

---

## Key Discoveries

### Backend Asymmetry
`IvaBooksRepository` has no `estadoSIN` field on `IvaPurchaseBook` (unlike sales which track SIN state). This makes reactivate/void logic simpler for purchases — no orthogonal state axis to preserve.

### PurchaseOrgSettings is IT-agnostic
`PurchaseOrgSettings` carries only three account codes: `cxpAccountCode`, `fleteExpenseAccountCode`, `polloFaenadoCOGSAccountCode`. IVA is hardcoded to `"1.1.8"`. There is NO IT account code in the domain, so purchases never emit IT lines (unlike sales). Spec scenarios mention "IVA and IT" but purchases structurally lack IT support.

### .test.tsx Extension Mandatory
Hook tests under the jsdom project (e.g., `use-lcv-unlink-purchase.test.ts`) MUST use `.test.tsx` extension for proper Jest configuration hookup, even though they test TypeScript files. The `.ts` extension is parsed as plain JavaScript.

### Radix Select Shims Required
Opening a Radix Select in jsdom tests requires these DOM method shims:
- `window.HTMLElement.prototype.scrollIntoView = vi.fn()`
- `window.Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false)`
- `setPointerCapture`, `releasePointerCapture`
Then trigger with `fireEvent.pointerDown(trigger, { button: 0 })` + `fireEvent.click(trigger)`.

### Filter Unification with OR Predicate
The purchase list filter uses a pseudo-value `COMPRA_GENERAL_O_SERVICIO` — no schema migration needed. The filter predicate simply checks `if (value === "COMPRA_GENERAL_O_SERVICIO") → match IN (COMPRA_GENERAL, SERVICIO); else → exact match`. FLETE and POLLO_FAENADO remain exact-match paths, untouched.

### Modal VOIDED Bug (Fixed)
Original `purchase-form.tsx:1589` didn't filter VOIDED status when auto-detecting create vs edit mode. This became observable once unlink/reactivate were added. Fixed in T3.2: modal `mode` and `entryId` now filter on `ivaPurchaseBook.status !== "VOIDED"`.

---

## Shipped Commits

| SHA | PR | Scope |
|---|---|---|
| `715c7ac` | PR1 | Move LcvIndicator to components/common |
| `068ffd2` | PR2 | reactivatePurchase backend trio (REQ-B.1, B.2, B.3) |
| `574ede3` | PR3 | LCV indicator in purchase-form header (REQ-A.1, A.2) + D.9 VOIDED fix |
| `abaa251` | PR4 | Unlink flow (REQ-A.3) |
| `b10711c` | PR5 | Reactivate flow for VOIDED records (REQ-A.4) |
| `44d6f96` | PR6 | Notas + Resumen de Pagos layout (REQ-A.5, A.6) |
| `d985358` | PR7 | Unify Compra general + Servicios (REQ-C.1, C.2) |
| `3ce42a9` | PR8 | Journal cascade regression tests |
| `078ea1c`, `73a4f65` | — | tasks.md checkoff chores |

---

## REQs Delivered

### REQ-A.1 — LCV Indicator in Header
**Status**: COMPLIANT  
Purchase form header row 2 displays LcvIndicator alongside Proveedor and Total. Derives state from `(isEditMode, purchase.ivaSalesBook, ivaSalesBook.status)` and renders S1/S2/S3 correctly.

### REQ-A.2 — LCV Indicator State Machine
**Status**: COMPLIANT  
S1 (draft): disabled grey. S2 (saved, unlinked or VOIDED): default click opens register modal. S3 (saved, ACTIVE): emerald distinct from CTA green, click opens Edit + Unlink menu.

### REQ-A.3 — Unlink from LCV
**Status**: COMPLIANT  
Confirmation dialog (no "Anular" word) → PATCH void endpoint → journal regenerated WITHOUT IVA/IT lines. Purchase record unchanged.

### REQ-A.4 — Reactivate from VOIDED
**Status**: COMPLIANT  
VOIDED state shows reactivate option. Confirmation dialog → PATCH reactivate endpoint → journal regenerated WITH IVA/IT lines. Purchase record unchanged.

### REQ-A.5 — Notas Relocated to Bottom Row
**Status**: COMPLIANT  
Notas shares bottom row with Resumen de Pagos. Grid layout: `grid-cols-1` mobile / `sm:grid-cols-2` at breakpoint.

### REQ-A.6 — Resumen Right-Aligned
**Status**: COMPLIANT  
Resumen container uses `flex flex-col gap-1 w-full text-sm`. Rows use `flex justify-between items-start gap-4`. Amount column: `font-mono text-right whitespace-nowrap`.

### REQ-B.1 — `reactivatePurchase` Service Method
**Status**: COMPLIANT  
Delegates to repo + calls `maybeRegenerateJournal("purchase", ...)`. Propagates ConflictError if already ACTIVE (journal not called).

### REQ-B.2 — `reactivatePurchase` Repository Method
**Status**: COMPLIANT  
Flips status VOIDED → ACTIVE. Guards against already-ACTIVE (ConflictError). Returns DTO. `estadoSIN` untouched.

### REQ-B.3 — PATCH reactivate Route
**Status**: COMPLIANT  
`app/api/organizations/[orgSlug]/iva-books/purchases/[id]/reactivate` — PATCH only. Resolves orgId + userId. Returns 200 + DTO on success; 404/409/401/403 on errors.

### REQ-C.1 — Unified Entry Button
**Status**: COMPLIANT  
Single "Compra / Servicio" button routes with `?type=COMPRA_GENERAL`. Historical `SV-xxx` records remain visible (no data migration).

### REQ-C.2 — Unified Filter Label
**Status**: COMPLIANT  
Collapse "Compra General" + "Servicios" filter options into one "Compras y Servicios" filter. OR predicate matches both types. FLETE/POLLO_FAENADO remain separate.

---

## Follow-Up Suggestions

### S.1 — Spec Wording: "IVA and IT" for Purchases
**Finding**: Spec scenarios REQ-A.3/A.4 and REQ-B.1 mention "IVA and IT lines" but purchases structurally never emit IT lines. `PurchaseOrgSettings` carries no IT account codes. Tests correctly verify only IVA lines + explicit no-IT guards exist.

**Recommendation**: Update spec wording to say "IVA lines only" for the purchase domain (distinguish from sales which do emit IT lines).

**Priority**: Low — behavior is correct; wording is imprecise.

### S.2 — Layout Mobile Rendering
**Finding**: REQ-A.5 mobile single-column layout is asserted via class presence (`grid-cols-1`) but not verified with an actual viewport render. JSDOM limitation — acceptable for unit tests.

**Recommendation**: Consider adding a visual regression test (Playwright or Storybook) to verify CSS breakpoint actual render behavior.

**Priority**: Low — unit tests confirm class structure; visual gap would benefit later.

---

## Final Metrics

- **Tasks**: 34 total (T1.1–T8.4 across 8 PRs)
- **Commits**: 10 (8 feature/test PRs + 2 chore checkoffs)
- **Tests added**: 56 new tests during cycle
- **Total test suite**: 820/820 passing
- **TypeScript**: `tsc --noEmit` clean
- **Regressions**: 0
- **Critical issues**: 0
- **Warnings**: 0
- **Suggestions**: 2 (cosmetic, non-blocking)

---

## Deferred Items (Out of Scope)

- **Document upload field** in Resumen area — explicitly deferred per proposal.
- **Option C (destructive migration)** — SERVICIO remains in Prisma enum; `SV-xxx` records stay readable; new records default to `COMPRA_GENERAL`. No migration, no rename of historical sequence numbers.

---

## DAG State: CLOSED

All SDD phases complete and archived:
- ✅ Exploration
- ✅ Proposal
- ✅ Spec
- ✅ Design
- ✅ Tasks
- ✅ Apply (8 PRs shipped)
- ✅ Verify (PASS)
- ✅ Archive (this report)

**Ready for the next change.**
