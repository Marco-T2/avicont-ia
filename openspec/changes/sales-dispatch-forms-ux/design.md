# Design: Sales & Dispatch Forms UX — LCV indicator + layout polish

## Technical Approach

Pure client-side UX refactor on top of existing backend. Extract a presentational `<LcvIndicator>` (S1/S2/S3 state machine) driven by `(isEditMode, sale.ivaSalesBook)`. Unlink reuses the already-wired HTTP endpoint `PATCH /api/organizations/[orgSlug]/iva-books/sales/[id]/void` — there is NO "use server" action in the project; the established pattern is `fetch` + API route + `IvaBooksService.voidSale`. Layout rework uses Tailwind grid primitives. No DB, no schema, no service-layer changes.

## Architecture Decisions

### D1. `<LcvIndicator>` component contract

**Choice**: New file `components/sales/lcv-indicator.tsx`. Props:
```ts
interface LcvIndicatorProps {
  state: "S1" | "S2" | "S3";
  periodOpen: boolean;            // for S2/S3 gating
  onRegister?: () => void;        // S2
  onEdit?: () => void;            // S3
  onUnlink?: () => void;          // S3
}
```
State is computed by the parent (`sale-form.tsx`) and passed in — component stays dumb.

**Alternatives**: (a) Let component derive state from `sale` prop → couples it to Sale shape. (b) Pass handlers only for applicable state → messier API.
**Rationale**: Explicit `state` keeps the component testable in isolation. Parent already holds `sale`, `isEditMode`, `isFiscalPeriodOpen`.

### D2. S3 popover UI primitive

**Choice**: Reuse existing `components/ui/dropdown-menu.tsx` (shadcn `DropdownMenu`). Wrap the emerald button as `<DropdownMenuTrigger asChild>`, expose two `<DropdownMenuItem>`: "Editar registro LCV" and "Desvincular del Libro de Ventas" (destructive styling on the second).

**Alternatives**: `Popover` primitive — NOT present in `components/ui/`. Adding a new shadcn primitive just for this menu is over-budget.
**Rationale**: DropdownMenu already exists, is keyboard-accessible, and gives us the menu semantics we need. No new dependency.

### D3. Unlink confirmation modal

**Choice**: Reuse existing `components/ui/dialog.tsx` via a small inline component or a dedicated `<UnlinkLcvConfirmDialog>` (decision deferred to sdd-tasks — pattern already used by `ConfirmTrimDialog` in `components/sales/`). Copy (Spanish, rioplatense):
- Title: "¿Desvincular esta venta del Libro de Ventas?"
- Body: "La venta se conserva. Solo se elimina el registro del Libro de Ventas IVA y el asiento contable se regenera sin líneas de IVA ni IT."
- Primary button: "Desvincular" (destructive tone, but NOT the word "Anular").
- Cancel: "Cancelar".

**Alternatives**: `AlertDialog` from shadcn — NOT present. Adding it for a single use case is over-budget.
**Rationale**: Matches the existing `ConfirmTrimDialog` pattern (dialog.tsx + custom component), minimizing surface area.

### D4. Emerald tone for S3 vs save-CTA green

**Choice**: S3 active button = `bg-emerald-50 border border-emerald-600 text-emerald-700 hover:bg-emerald-100`. Icon: `BookOpenCheck` from lucide-react (distinct from `BookOpen` on S2).

The save-CTA ("Guardar y contabilizar") uses solid `bg-green-600 hover:bg-green-700` with white text. S3 is an outline-style emerald on a light background → **visually distinct by both hue (emerald vs green) and style (outline vs solid)**.

**Alternatives**: Solid emerald-600 → too close to CTA. Blue/teal tone → breaks "success/registered" semantics.
**Rationale**: Color + style separation prevents user confusion. Matches the proposal's Risk-Mitigation table.

### D5. Unlink endpoint (no new server action)

**Choice**: Reuse existing `PATCH /api/organizations/[orgSlug]/iva-books/sales/[id]/void`. The route already:
- Auths via Clerk (`requireAuth` + `requireOrgAccess` + `requireRole` for owner/admin/contador).
- Calls `IvaBooksService.voidSale(orgId, userId, id)`.
- Triggers `maybeRegenerateJournal` inside the service (engram #625) — journal is rebuilt WITHOUT IVA/IT when no active IvaBook link exists.

**Important**: `id` in the URL is the **`ivaSalesBook.id`**, NOT the sale id. The form must pass `sale.ivaSalesBook.id`.

Client flow (matches existing `handleVoid` / `handleDelete`):
```
click "Desvincular" → confirm → fetch PATCH → toast + router.refresh()
```

**Alternatives**: New `"use server"` server action wrapping `voidSale` → the project has ZERO server actions today; every mutation goes through `fetch` + API route. Introducing server actions here breaks the prevailing pattern.
**Rationale**: Consistency with the rest of sale-form.tsx. Zero new backend code.

### D6. Layout — Notas + Resumen de Cobros shared row

**Choice**: Replace the current two single-column rows with one grid:
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  <div>{/* Notas textarea */}</div>
  <div>{/* Resumen de Cobros (solo si aplica) */}</div>
</div>
```
When `sale.receivable` is null (DRAFT or no CxC), the Resumen column renders empty — Notas then visually occupies the left half and the right half is empty (acceptable, matches the pattern used on the read-only `dl` grid). If we want Notas to span full width in that case, add a conditional `sm:col-span-2` on the Notas wrapper when `!sale?.receivable`.

**Rationale**: Tailwind grid collapses gracefully to single column below `sm:`. Satisfies REQ-A.4, REQ-A.6 and their dispatch counterparts.

### D7. Right-align payment detail rows

**Choice**: Refactor the Resumen de Cobros `<table>` into a flex column of right-aligned rows:
```tsx
<div className="flex flex-col gap-1 text-sm ml-auto w-fit">
  <div className="flex justify-between gap-4 font-semibold border-b py-1">
    <span>Total CxC</span><span className="font-mono">{formatCurrency(...)}</span>
  </div>
  {allocations.map(a => (
    <div key={a.id} className="flex justify-between gap-4 text-muted-foreground py-0.5">
      <Link className="underline underline-offset-2">Cobro el {date} — {desc}</Link>
      <span className="font-mono text-green-700">-{formatCurrency(a.amount)}</span>
    </div>
  ))}
  <div className="flex justify-between gap-4 border-t-2 font-bold py-1">
    <span>Saldo pendiente</span><span className="font-mono">{formatCurrency(balance)}</span>
  </div>
</div>
```
`ml-auto w-fit` pushes the group to the right without stretching. Apply same refactor in `dispatch-form.tsx` around line ~1419.

**Alternatives**: Keep `<table>` and add `text-right` + fixed column widths → still looks stretched on wide cards.
**Rationale**: Proposal REQ-A.5 / B.2 explicitly calls out "stretched edge-to-edge with a huge gap". Flex + `ml-auto` is the idiomatic Tailwind fix.

### D8. Dispatch form parity (NDD + BC only)

**Choice**: Apply D6 and D7 inside the two dispatch type branches. Grep shows a single Resumen de Cobros block (~line 1419 in `dispatch-form.tsx`) used by both NDD and BC. The Notas relocation hits rows around lines 967-1012. The third dispatch variant (NVA or similar) is out of scope.

## Data Flow

```
User click S3 indicator
   └─> DropdownMenu opens
         ├─ "Editar registro LCV"  → opens IvaBookSaleModal (existing)
         └─ "Desvincular del LCV"  → UnlinkConfirmDialog
                                        └─ confirm
                                            └─ fetch PATCH /iva-books/sales/{ivaBookId}/void
                                                └─ IvaBooksService.voidSale
                                                      └─ maybeRegenerateJournal (no IVA/IT)
                                                            └─ router.refresh()
                                                                  └─ state recomputes → S2
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `components/sales/lcv-indicator.tsx` | Create | Presentational LCV indicator (S1/S2/S3), ~80 LOC |
| `components/sales/unlink-lcv-confirm-dialog.tsx` | Create | Confirmation dialog mirroring `ConfirmTrimDialog` pattern |
| `components/sales/sale-form.tsx` | Modify | Insert LcvIndicator in row 2, remove footer LCV button (lines 873-887), restructure Notas/Resumen layout (lines 635-659, 807-853), add unlink handler (`handleUnlinkLcv`) |
| `components/dispatches/dispatch-form.tsx` | Modify | Notas relocation + Resumen right-align for NDD + BC only |
| `components/sales/__tests__/lcv-indicator.test.tsx` | Create | States S1/S2/S3 render + click behavior |
| `features/sale/__tests__/*unlink*.test.ts` | Create | Regression: unlink path regenerates journal without IVA/IT (adapt from `iva-books.service.cascade.test.ts`) |

## Interfaces / Contracts

### `<LcvIndicator>` props
```ts
type LcvIndicatorState = "S1" | "S2" | "S3";
interface LcvIndicatorProps {
  state: LcvIndicatorState;
  periodOpen: boolean;
  onRegister?: () => void;
  onEdit?: () => void;
  onUnlink?: () => void;
}
```
Invariants:
- `state === "S1"` → fully disabled, no handlers invoked on click.
- `state === "S2"` → single click calls `onRegister` (gated by `periodOpen`).
- `state === "S3"` → click opens DropdownMenu; items call `onEdit` / `onUnlink` (both gated by `periodOpen`).

### Unlink HTTP contract (pre-existing)
```
PATCH /api/organizations/{orgSlug}/iva-books/sales/{ivaBookId}/void
Response 200: IvaSalesBookDTO (status = VOIDED)
Response 401/403/404: handled by handleError
```
Client wraps in a small `handleUnlinkLcv(ivaBookId: string)` in `sale-form.tsx`, mirrors `handleVoid` structure (confirm → fetch → toast → `router.refresh()`).

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `<LcvIndicator>` S1/S2/S3 render + click handlers | Vitest + RTL, role/text assertions (not snapshots) |
| Unit | `<UnlinkLcvConfirmDialog>` copy + confirm/cancel | RTL: assert dialog does NOT contain "Anular"; confirm calls `onConfirm` |
| Integration | Unlink flow regenerates journal WITHOUT IVA/IT | Extend `features/sale/__tests__/` — mock or use existing infra that covers `voidSale` + `maybeRegenerateJournal`. Assert `JournalEntryLine` rows have zero IVA/IT accounts. |
| Layout | Notas + Resumen share row at `sm:`; Resumen payment rows right-aligned | RTL: query by label/text, assert classes via `toHaveClass("ml-auto")` — or snapshot the DOM subtree |

No e2e required — pure UI refactor over tested backend.

## Migration / Rollout

No migration. No feature flag. Ship as a single commit (or split: indicator extraction → unlink action → layout). Revert = revert commit(s). The footer button removal is the only visible regression if someone bookmarks the old flow — LCV indicator in the header is strictly more discoverable.

## Open Questions

- [ ] When `sale.receivable` is null (DRAFT), should Notas span full width (`sm:col-span-2`) or leave the right half empty? Leaning full-width for DRAFT — confirm with user in sdd-tasks phase.
- [ ] Should "Editar registro LCV" in the S3 menu open the same `IvaBookSaleModal` in `edit` mode that today's footer button opens? Assumed YES (reuse existing `setIvaModalOpen(true)` path); confirm.
