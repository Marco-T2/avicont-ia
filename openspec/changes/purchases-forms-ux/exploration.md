## Exploration: purchases-forms-ux

### Current State

**Single unified form component — already.**
`components/purchases/purchase-form.tsx` is ONE component that handles all four purchase types (`FLETE`, `POLLO_FAENADO`, `COMPRA_GENERAL`, `SERVICIO`) via a `purchaseType` prop discriminator — exactly analogous to how `DispatchForm` handles `NOTA_DESPACHO` vs `BOLETA_CERRADA`. The type is passed from the page via a `?type=` query param. The routes are:
- `app/(dashboard)/[orgSlug]/purchases/new/page.tsx` — reads `?type=` and renders `<PurchaseForm purchaseType={...} mode="new">`
- `app/(dashboard)/[orgSlug]/purchases/[purchaseId]/page.tsx` — reads `purchase.purchaseType` and passes it in

**COMPRA_GENERAL vs SERVICIO — functionally identical today.**
Both share the same detail table (`generalLines`), same validation, same journal-building path in `purchase.utils.ts` (line 76–77, 108: "COMPRA_GENERAL o SERVICIO: primer detalle"), same sequence namespace (separate: `CG-xxx` vs `SV-xxx` via `@@unique([organizationId, purchaseType, sequenceNumber])`), and both link to `IvaPurchaseBook`. The only differences are:
1. Separate sequence counters (CG prefix vs SV prefix) — this is a data-level distinction, not a behavioral one.
2. Separate `purchaseType` filter in the list view (the list UI has separate filter options "Compra General" and "Servicio").
3. Separate "Nueva Compra General" and "Nuevo Servicio" buttons in `purchase-list.tsx` (lines 230, 252).

**LCV UI — exists but as a bottom-action button, NOT as an in-header indicator.**
`purchase-form.tsx` currently has a `<Button>Registrar Libro de Compras</Button>` (or "Editar...") placed in the **action bar at the bottom left** (lines 1453–1467), gated by `isFiscalPeriodOpen`. There is NO `LcvIndicator` S1/S2/S3 state-machine button in the form header yet. The `IvaBookPurchaseModal` is wired, and `purchase.ivaPurchaseBook` is already included in the data.

**Unlink/Reactivate — void endpoint exists, reactivate does NOT.**
- `PATCH /api/organizations/[orgSlug]/iva-books/purchases/[id]/void` — EXISTS (`void/route.ts`)
- `PATCH /api/organizations/[orgSlug]/iva-books/purchases/[id]/reactivate` — DOES NOT EXIST (no route file, no `reactivatePurchase` in service or repository)
- `IvaBooksService.voidPurchase()` — exists (lines 338–370 of `iva-books.service.ts`)
- `IvaBooksService.reactivatePurchase()` — MISSING
- `IvaBooksRepository.voidPurchase()` — exists
- `IvaBooksRepository.reactivatePurchase()` — MISSING
- Sales analogs: `reactivateSale` exists in both service and repository (`iva-books.repository.ts:427`)

**`IvaPurchaseBook` schema vs `IvaSalesBook` schema — key differences:**
- `IvaPurchaseBook.purchaseId` is `@unique` (one-to-one) — same as `IvaSalesBook.saleId @unique`
- `IvaPurchaseBook` has `tipoCompra Int @default(1)` — IvaSalesBook has `estadoSIN IvaSalesEstadoSIN` (a different field entirely; sales track SIN state, purchases track "tipo de compra" as an integer 1-5)
- `IvaPurchaseBook` has NO `estadoSIN` — so the reactivate/void logic is simpler (no SIN state to preserve)
- Both share `IvaBookStatus` enum (`ACTIVE` / `VOIDED`)

**Notas field — currently in the WRONG position.**
`purchase-form.tsx` lines 887–910: "Notas (opcional)" and "Descripción" are stacked together in a single-column grid, above the detail lines card. The CxP (Resumen de Pagos) is rendered in a separate standalone `<Card>` BELOW the detail lines (lines 1388–1433). These two are not in the same row — they are separated by the entire detail lines table.

**Resumen de Pagos (CxP) — not right-aligned.**
The CxP summary table in `purchase-form.tsx` (lines 1394–1430) uses a plain `<table>` inside a `<Card>` without `w-full flex justify-between items-start text-right`. The sales reference pattern (shipped in sale-form.tsx:873) uses `<div className="flex flex-col gap-1 w-full text-sm">` with `<div className="flex justify-between items-start gap-4 ...">` for each row.

**Existing tests — one test file.**
`components/purchases/__tests__/purchase-form-iva-gate.test.tsx` — 4 tests covering the `isFiscalPeriodOpen` gate on the "Registrar Libro de Compras" button (SPEC-5). After this change, these tests will need to be updated because the button placement and label will change (it moves to the header and becomes an `LcvIndicator`).

---

### Affected Areas

- `components/purchases/purchase-form.tsx` — primary change target: add LcvIndicator to header row 2, relocate Notas to bottom row with CxP summary, fix CxP layout, add unlink/reactivate dialog state
- `components/purchases/` (new files) — need to create: `use-lcv-unlink-purchase.ts`, `use-lcv-reactivate-purchase.ts`, `unlink-lcv-confirm-dialog-purchase.tsx` (or reuse the sales dialogs if props are generic enough), `reactivate-lcv-confirm-dialog-purchase.tsx`
- `app/api/organizations/[orgSlug]/iva-books/purchases/[id]/reactivate/route.ts` — MISSING, must be created
- `features/accounting/iva-books/iva-books.service.ts` — add `reactivatePurchase()` method
- `features/accounting/iva-books/iva-books.repository.ts` — add `reactivatePurchase()` method
- `components/purchases/__tests__/purchase-form-iva-gate.test.tsx` — must be updated (button moves to header as LcvIndicator)
- `components/purchases/purchase-list.tsx` — if COMPRA_GENERAL+SERVICIO are unified: update "Nueva" buttons, filter options, type labels
- `features/purchase/purchase.utils.ts` — if types are unified: may need to remove SERVICIO from TYPE_PREFIXES or add a merged prefix
- `prisma/schema.prisma` — if types are unified at data layer: requires migration to merge enum values (HIGH RISK)

---

### Approaches

**Option A — Port LCV + UX only; keep COMPRA_GENERAL and SERVICIO as separate types (recommended for this change)**

Add LcvIndicator to purchase-form header (same deriveLcvState pattern as sale-form), create the missing unlink/reactivate infrastructure for purchases, relocate Notas to bottom row alongside CxP summary with the `flex justify-between` fix. NO schema changes. COMPRA_GENERAL and SERVICIO remain two separate `purchaseType` values with their own sequences and list entries.

- Risk: Low — purely additive UI + two new backend methods
- Data continuity: zero migration needed
- Tests: update existing 4 tests for new button location; add new tests for LCV state machine, unlink, reactivate

**Option B — Merge COMPRA_GENERAL + SERVICIO at UI level only, keep DB enum unchanged**

In `purchase-list.tsx`, replace the two separate "Nueva Compra General" / "Nueva Servicio" buttons with a single "Nueva Compra y Servicios" button that routes to `?type=COMPRA_GENERAL`. Rename the label in the UI to "Compras y Servicios". Keep `SERVICIO` enum value in the DB but stop creating new records with it (existing records remain readable). In `purchase-form.tsx`, the `purchaseType` prop still accepts both but "SERVICIO" becomes a legacy-read-only display value.

- Risk: Medium — new records all become COMPRA_GENERAL; existing SERVICIO records still render but sequence `SV-xxx` is frozen. List filter collapses both into one filter option.
- Data continuity: no migration; existing SV-xxx records are unaffected
- Tests: minor updates to list component tests if they exist

**Option C — Full merge at data layer (COMPRA_GENERAL absorbs SERVICIO)**

Add a Prisma migration: change all existing `SERVICIO` rows to `COMPRA_GENERAL`, remove `SERVICIO` from the `PurchaseType` enum. Single sequence counter `CG-xxx` going forward. Update all validation, utils, and form code.

- Risk: HIGH — Prisma enum removal requires PostgreSQL migration with potential downtime; all existing `SV-xxx` displayCodes become `CG-xxx` (cosmetic break in history); any external reports or exports referencing `SERVICIO` break
- Data continuity: destructive for existing records; requires careful migration
- Not recommended for this change cycle

---

### Recommendation

**Ship as two sequential sub-tasks:**

1. **LCV + UX parity (Option A)** — the straightforward port: LcvIndicator in header, unlink/reactivate infrastructure for purchases, Notas relocation, CxP right-align fix. This is the core of what was done for sales and can be implemented without touching the schema.

2. **COMPRA_GENERAL + SERVICIO unification (Option B, UI-only)** — done AFTER the LCV work is stable. Collapse the two entry points in the list into one "Compras y Servicios" button pointing to `?type=COMPRA_GENERAL`. Rename labels. Keep `SERVICIO` enum intact in DB (no migration). Existing `SV-xxx` records remain fully readable and searchable via the merged list filter. This gives the user the desired UX simplification without the data migration risk of Option C.

The key insight is that `purchase-form.tsx` already handles COMPRA_GENERAL and SERVICIO identically in every code path — the form IS already unified at the component level. The only "split" is the entry button and the list filter label. Option B is essentially a cosmetic change.

---

### Risks

- **Missing `reactivatePurchase` backend** — the unlink flow (`voidPurchase`) exists, but there is no `reactivatePurchase` anywhere (service, repository, or API route). This must be created before the LCV S2→S3 reactivate flow can work. The implementation is straightforward — mirror `reactivateSale` in repository (status check + update to ACTIVE) and service (call repo + `maybeRegenerateJournal`).
- **Existing test breakage** — `purchase-form-iva-gate.test.tsx` queries for `getByRole("button", { name: /registrar libro de compras/i })`. After this change the LCV button in the header will be the primary LCV control; the bottom button goes away. All 4 tests need to be rewritten to target the `LcvIndicator` (data-lcv-state attribute pattern).
- **`IvaPurchaseBook.purchaseId @unique`** — already `@unique`, so the one-to-one constraint matches the sales pattern exactly. No schema change needed for LCV linkage.
- **`tipoCompra` is a numeric field (1–5) on `IvaPurchaseBook`, NOT derived from `purchaseType`** — it is user-entered in the `IvaBookPurchaseModal`. Merging COMPRA_GENERAL and SERVICIO into a single UI type does NOT affect `tipoCompra` values. They remain independently settable per LCV entry.
- **Sequence counters are per-type** — merging at Option B level means no new `SV-xxx` sequences are created, but existing ones are intact. The `@@unique([organizationId, purchaseType, sequenceNumber])` constraint remains valid.
- **No `reactivate` route for purchases but DOES have a `void` route** — this asymmetry means the "S2 button" in the LCV indicator for purchases cannot currently reactivate a previously-voided entry. The `onRegister` handler in sale-form (line 680) checks `sale.ivaSalesBook?.status === "VOIDED"` to decide whether to reactivate vs create new. The same logic must be wired on the purchase side once the reactivate endpoint is built.

---

### Ready for Proposal

Yes — all necessary information is available. The two sub-tasks are well-scoped:
1. LCV UX parity (indicator + unlink + reactivate + Notas/CxP layout) — clear implementation path, no schema changes
2. COMPRA_GENERAL + SERVICIO UI unification — cosmetic entry-point collapse, no data migration

No clarification needed from the user before proposing.
