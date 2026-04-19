# Design: Purchases Forms UX — LCV indicator + CG/SERVICIO unification

## Technical Approach

Port the `sales-dispatch-forms-ux` work to `purchase-form.tsx` with one backend addition: the missing `reactivatePurchase` trio (repo + service + PATCH route) that mirrors `reactivateSale` 1:1. Everything else is pure client-side UX: move the LCV control from the footer into header row 2 as a stateful `<LcvIndicator>`, create `use-lcv-unlink-purchase` / `use-lcv-reactivate-purchase` hooks (thin wrappers over `fetch` + PATCH), reuse the already-wired `voidPurchase` path (bridge to `maybeRegenerateJournal` already in place), relocate Notas into a `bottom-row` grid next to the CxP summary, and refactor the CxP `<table>` into the flex/`justify-between`/`text-right` pattern shipped in `sale-form.tsx` (commit `fbea108`). Sub-task B collapses the two entry buttons and the two list filter options for `COMPRA_GENERAL` and `SERVICIO` into one "Compra / Servicio" label without any schema change — legacy `SV-xxx` records keep rendering via their stored `displayCode`.

No `"use server"` actions — the established pattern is `fetch` + API route. No Prisma migration. No changes to `FLETE` or `POLLO_FAENADO` flows.

## Architecture Decisions

### D1. `<LcvIndicator>` — reuse as-is, move file to shared location

**Verified**: `components/sales/lcv-indicator.tsx` already uses LCV-generic copy:
- S1: `"LCV no disponible"`
- S2: `"Registrar en LCV"`
- S3: `"Registrado en LCV"`

No sales-specific strings. Props are domain-agnostic: `{ state, periodOpen, onRegister?, onEdit?, onUnlink? }`. The DropdownMenu items say `"Editar"` and `"Desvincular del LCV"`. This is ALREADY purchases-ready.

**Choice: D.1.a — Move to shared.** Relocate the file to `components/common/lcv-indicator.tsx` and update both `sale-form.tsx` and the new `purchase-form.tsx` to import from there.

Two reasons:
1. The component is already domain-agnostic — forking it into `components/purchases/lcv-indicator.tsx` would immediately create duplicated source of truth for a UI primitive that has zero domain coupling.
2. "LCV" is overloaded: Libro de Compras/Ventas. The component name and copy work for both. Putting it under `components/sales/` is misleading.

**Migration**: one-file move + two import lines in `sale-form.tsx`. Low risk.

**Rejected D.1.b (duplicate)**: creates two files that WILL drift. Easy to regret in a month.

### D2. Derive state: `deriveLcvStatePurchase` (parallel to sales)

**Choice**: Put a local pure helper inside `purchase-form.tsx` — mirror how `deriveLcvState` lives inside `sale-form.tsx`.

```ts
function deriveLcvStatePurchase(
  purchase:
    | { status: string; ivaPurchaseBook?: { id: string; status?: string } | null }
    | undefined,
): LcvState {
  if (!purchase || purchase.status === "DRAFT") return "S1";
  if (!purchase.ivaPurchaseBook || purchase.ivaPurchaseBook.status === "VOIDED") return "S2";
  return "S3";
}
```

**Schema verification**: `prisma/schema.prisma` line 999 — `IvaPurchaseBook.status IvaBookStatus @default(ACTIVE)` with enum `ACTIVE` / `VOIDED` (schema.prisma:505-508). No blocker.

Not hoisting to a shared util because:
- Each derivation is 4 lines.
- The two entities have different field names (`ivaSalesBook` vs `ivaPurchaseBook`) and putting that behind a generic helper adds type-gymnastics for zero readability win.

### D3. S3 menu behavior — symmetric with sales

**Choice**: In S3 the DropdownMenu opens with two items → `"Editar"` triggers `setIvaModalOpen(true)` (opens `IvaBookPurchaseModal` in `edit` mode), `"Desvincular del LCV"` triggers `setUnlinkDialogOpen(true)`. In S2, clicking the button directly:
- if `purchase?.ivaPurchaseBook?.status === "VOIDED"` → `setReactivateDialogOpen(true)`
- else → `setIvaModalOpen(true)` (modal opens in `create-from-source` mode)

This matches the sales pattern at `sale-form.tsx:678-688` verbatim. No surprises for the user muscle memory switching between the two forms.

### D4. `reactivatePurchase` — backend trio, mirror `reactivateSale`

**Repository** (`features/accounting/iva-books/iva-books.repository.ts`):

```ts
async reactivatePurchase(orgId: string, id: string): Promise<IvaPurchaseBookDTO> {
  const existing = await this.db.ivaPurchaseBook.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!existing) throw new NotFoundError("Entrada de Libro de Compras");

  if (existing.status !== "VOIDED") {
    throw new ConflictError("La entrada ya está activa (status !== VOIDED)");
  }

  const row = await this.db.ivaPurchaseBook.update({
    where: { id },
    data: { status: "ACTIVE" },
  });

  return toPurchaseDTO(row);
}
```

Exact parity with `reactivateSale` (iva-books.repository.ts:427-445). NO `estadoSIN` concern on purchases — the field does not exist on `IvaPurchaseBook` (schema.prisma:932-963 lacks the column; only `IvaSalesBook` has `estadoSIN`). That makes the purchase reactivate *simpler* than sales, not more complex.

**Service** (`features/accounting/iva-books/iva-books.service.ts`):

```ts
async reactivatePurchase(
  orgId: string,
  userId: string,
  id: string,
): Promise<IvaPurchaseBookDTO> {
  // status = ACTIVE — no estadoSIN en purchases
  const result = await this.repo.reactivatePurchase(orgId, id);

  // SPEC-6: bridge regeneración (IVA path — IvaBook ya tiene status ACTIVE)
  const purchaseId = result.purchaseId;
  if (purchaseId && userId) {
    await this.maybeRegenerateJournal("purchase", purchaseId, orgId, userId);
  }

  return result;
}
```

**Bridge verification**: `maybeRegenerateJournal("purchase", ...)` exists at `iva-books.service.ts:164-177`. It reads `period.status`, throws `FISCAL_PERIOD_CLOSED` if CLOSED + POSTED, otherwise calls `purchaseService.regenerateJournalForIvaChange(...)`. Same code path already exercised by `voidPurchase` (line 366) and `updatePurchase` (line 332) — this is the established pattern. When status flips back to `ACTIVE`, the journal regeneration picks up the new IVA link and rebuilds WITH IVA + IT lines (same behavior as sales).

No purchase-specific path needed. `maybeRegenerateJournal` is the single source of truth for both sides.

**Route** (`app/api/organizations/[orgSlug]/iva-books/purchases/[id]/reactivate/route.ts`):

```ts
import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { IvaBooksService } from "@/features/accounting/iva-books/iva-books.service";
import { IvaBooksRepository } from "@/features/accounting/iva-books/iva-books.repository";
import { SaleService } from "@/features/sale/sale.service";
import { PurchaseService } from "@/features/purchase/purchase.service";

const service = new IvaBooksService(
  new IvaBooksRepository(),
  new SaleService(),
  new PurchaseService(),
);

/**
 * PATCH /api/organizations/[orgSlug]/iva-books/purchases/[id]/reactivate
 *
 * Reactiva una entrada VOIDED del Libro de Compras IVA (status → ACTIVE).
 * Regenera el asiento contable CON IVA e IT (buildPurchaseEntryLines IVA path).
 *
 * Respuestas:
 * - 200: IvaPurchaseBookDTO con status = ACTIVE
 * - 401: sin sesión Clerk
 * - 403: sin acceso a la org o rol insuficiente
 * - 404: entrada no encontrada
 * - 409: la entrada ya está ACTIVE (guard idempotencia)
 */
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; id: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, id } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

    const entry = await service.reactivatePurchase(orgId, userId, id);

    return Response.json(entry);
  } catch (error) {
    return handleError(error);
  }
}
```

**Next.js 16 params verification**: Confirmed via `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` and `route.md` examples — `params` is typed as `Promise<{ ... }>` and awaited inside the handler. The existing `void/route.ts` for purchases (line 30-35) already follows this pattern. Copy that pattern verbatim.

**id semantics**: `id` param is `ivaPurchaseBook.id`, NOT `purchase.id`. Same convention as the sales reactivate route. The form passes `purchase.ivaPurchaseBook?.id` to the hook.

### D5. Unlink hook — mirror `use-lcv-unlink.ts`

**File**: `components/purchases/use-lcv-unlink-purchase.ts`

```ts
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function useLcvUnlinkPurchase(
  orgSlug: string,
  ivaBookId: string | undefined,
) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleUnlink(): Promise<void> {
    if (!ivaBookId) return;
    setIsPending(true);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/iva-books/purchases/${ivaBookId}/void`,
        { method: "PATCH" },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? "Error al desvincular del LCV",
        );
      }
      toast.success("Compra desvinculada del LCV");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al desvincular del LCV");
    } finally {
      setIsPending(false);
    }
  }

  return { handleUnlink, isPending };
}
```

**Key invariant**: the URL uses `ivaPurchaseBook.id`, not `purchase.id`. The void route (`app/api/organizations/[orgSlug]/iva-books/purchases/[id]/void/route.ts`) takes the IvaPurchaseBook id and calls `IvaBooksService.voidPurchase(orgId, userId, id)` which runs the bridge. Verified.

### D6. Reactivate hook — mirror `use-lcv-reactivate.ts`

**File**: `components/purchases/use-lcv-reactivate-purchase.ts`

Identical shape to D5, different endpoint and success toast:
- URL: `/api/organizations/${orgSlug}/iva-books/purchases/${ivaBookId}/reactivate`
- Toast success: `"Compra reactivada en el LCV"`
- Toast error fallback: `"Error al reactivar el registro LCV"`

### D7. Confirm dialogs — new files under `components/purchases/`

**Files**:
- `components/purchases/unlink-lcv-confirm-dialog-purchase.tsx`
- `components/purchases/reactivate-lcv-confirm-dialog-purchase.tsx`

**Decision**: new files, NOT reuse the sales dialogs. Two reasons:
1. Copy is domain-specific ("la compra se conserva", "Libro de Compras", "la compra se regenera").
2. Cheap to keep separate — 70 LOC each, no logic, Spanish strings only. Generalizing a two-purpose dialog with a `domain="sale" | "purchase"` prop is more code than just forking two tiny files and saves nothing in maintenance.

**Strings (Spanish, rioplatense — match existing tone)**:

Unlink:
- Title: `"Desvincular del Libro de Compras"`
- Body: `"No se elimina la compra — solo se elimina el vínculo con el LCV. La compra se conserva intacta. El asiento contable se regenera sin IVA ni IT. ¿Confirmás?"`
- Primary button: `"Desvincular"` (variant="destructive")
- Cancel: `"Cancelar"`

Reactivate:
- Title: `"Reactivar registro en el Libro de Compras"`
- Body: `"Se reactivará el registro anterior del LCV y el comprobante se regenerará con IVA e IT. ¿Confirmás?"`
- Primary button: `"Reactivar"` (default variant)
- Cancel: `"Cancelar"`

Props shape — identical to sales counterparts:
```ts
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
}
```

### D8. `purchase-form.tsx` — LcvIndicator placement (header row 2)

**Choice**: Replace the current footer button (lines 1453-1467) and add the LcvIndicator in header row 2 alongside `Proveedor | Total`. Mirror the pattern at `sale-form.tsx:672-689`.

Required wiring inside `purchase-form.tsx`:

```tsx
import { LcvIndicator } from "@/components/common/lcv-indicator";
import type { LcvState } from "@/components/common/lcv-indicator";
import { UnlinkLcvConfirmDialogPurchase } from "@/components/purchases/unlink-lcv-confirm-dialog-purchase";
import { ReactivateLcvConfirmDialogPurchase } from "@/components/purchases/reactivate-lcv-confirm-dialog-purchase";
import { useLcvUnlinkPurchase } from "@/components/purchases/use-lcv-unlink-purchase";
import { useLcvReactivatePurchase } from "@/components/purchases/use-lcv-reactivate-purchase";

// inside component:
const [unlinkDialogOpen, setUnlinkDialogOpen] = useState(false);
const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);
const { handleUnlink, isPending: isUnlinking } = useLcvUnlinkPurchase(
  orgSlug,
  purchase?.ivaPurchaseBook?.id,
);
const { handleReactivate, isPending: isReactivating } = useLcvReactivatePurchase(
  orgSlug,
  purchase?.ivaPurchaseBook?.id,
);

// row 2 slot:
{isEditMode && purchase && (
  <div className="space-y-2">
    <Label>Libro de Compras (LCV)</Label>
    <LcvIndicator
      state={deriveLcvStatePurchase(purchase)}
      periodOpen={isFiscalPeriodOpen(purchase.period)}
      onRegister={() => {
        if (purchase.ivaPurchaseBook?.status === "VOIDED") {
          setReactivateDialogOpen(true);
        } else {
          setIvaModalOpen(true);
        }
      }}
      onEdit={() => setIvaModalOpen(true)}
      onUnlink={() => setUnlinkDialogOpen(true)}
    />
  </div>
)}
```

Then the two dialogs render near the modal at the bottom of the JSX tree (same position as sales).

**Remove**: the entire footer LCV button block at `purchase-form.tsx:1453-1467`.

### D9. Modal mode — parity with sales

**Sales pattern** (`sale-form.tsx:1081`):
```tsx
mode={sale.ivaSalesBook && sale.ivaSalesBook.status !== "VOIDED" ? "edit" : "create-from-source"}
```

**Purchase equivalent** (current line 1589 is buggy — checks `purchase.ivaPurchaseBook` truthiness without filtering VOIDED; a VOIDED IvaBook should open the modal in `create-from-source`, not `edit`):
```tsx
mode={purchase.ivaPurchaseBook && purchase.ivaPurchaseBook.status !== "VOIDED" ? "edit" : "create-from-source"}
```

**Also fix** the `entryId` so it's `undefined` when VOIDED (otherwise modal would try to edit a voided row):
```tsx
entryId={
  purchase.ivaPurchaseBook && purchase.ivaPurchaseBook.status !== "VOIDED"
    ? purchase.ivaPurchaseBook.id
    : undefined
}
```

This is a latent bug in the purchase modal wiring that becomes observable as soon as unlink/reactivate exist. Flagging it inside this change.

### D10. Bottom row — Notas + Resumen de Pagos

**Current** (`purchase-form.tsx:886-910` and `1387-1433`): Notas sits mid-form alongside Descripción inside a `grid-cols-1 gap-4` block BEFORE the details table. CxP (Resumen de Pagos) is its own `<Card>` AFTER the details table, full-width, using `<table className="w-full text-sm">` with a 2-col layout.

**Choice**: Mirror sales exactly — one grid `bottom-row` placed AFTER the details table, BEFORE the actions row. Descripción stays where it is (mid-form, near the type-specific fields).

```tsx
{/* Bottom row: Notas (izq) + Resumen de Pagos (der) */}
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="bottom-row">
  {/* Notas — siempre visible en slot izquierdo */}
  <div className="space-y-2">
    <Label htmlFor="purchase-notes">Notas (opcional)</Label>
    <Textarea
      id="purchase-notes"
      placeholder="Observaciones adicionales..."
      value={notes}
      onChange={(e) => setNotes(e.target.value)}
      readOnly={isReadOnly}
      className={isReadOnly ? "bg-muted cursor-default" : undefined}
    />
  </div>

  {/* Resumen de Pagos — slot derecho, solo cuando hay payable */}
  {purchase?.payable != null && (status === "POSTED" || status === "LOCKED") ? (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Resumen de Pagos (CxP)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-1 w-full text-sm">
          <div className="flex justify-between items-start gap-4 border-b pb-2 font-semibold">
            <span>Total CxP (Bs.)</span>
            <span className="font-mono text-right">{formatCurrency(purchase.payable.amount)}</span>
          </div>
          {purchase.payable.allocations.map((alloc) => (
            <div
              key={alloc.id}
              className="flex justify-between items-start gap-4 text-muted-foreground py-1"
            >
              <Link
                href={`/${orgSlug}/payments/${alloc.paymentId}`}
                className="underline underline-offset-2 hover:text-foreground transition-colors"
              >
                Pago el{" "}
                {new Date(alloc.payment.date).toLocaleDateString("es-BO")}
                {alloc.payment.description ? ` — ${alloc.payment.description}` : ""}
              </Link>
              <span className="font-mono text-green-700 text-right whitespace-nowrap">
                -{formatCurrency(alloc.amount)}
              </span>
            </div>
          ))}
          <div
            className={`flex justify-between items-start gap-4 border-t-2 pt-2 font-bold ${
              purchase.payable.balance > 0 ? "text-red-600" : "text-green-700"
            }`}
          >
            <span className="text-foreground">Saldo pendiente</span>
            <span className="font-mono text-right">{formatCurrency(purchase.payable.balance)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  ) : (
    <div />
  )}
</div>
```

Key class patterns from commit `fbea108`:
- outer container: `flex flex-col gap-1 w-full text-sm` (replaces `<table>`)
- each row: `flex justify-between items-start gap-4`
- amount span: `font-mono text-right whitespace-nowrap` (prevents wrapping in the narrow column)
- `border-b pb-2` for the total header line, `border-t-2 pt-2` for the final balance line
- when receivable/payable is null, render empty `<div />` in the right slot so the left column doesn't stretch

**Remove**: the old standalone `<Card>` for CxP at lines 1387-1433. Move the shrunken version into the bottom row.

**Remove**: the `Notas (opcional)` block at lines 887-898 from the mid-form grid. Leave `Descripción` where it is (its own single-column block).

### D11. Sub-task B — `purchase-list.tsx` unification

**Current behavior verified** (`purchase-list.tsx`):
- Lines 218-238: `<Card>` "Compra General" + `<Link href={`/${orgSlug}/purchases/new?type=COMPRA_GENERAL`}>` button.
- Lines 240-260: `<Card>` "Servicio" + `<Link href={`/${orgSlug}/purchases/new?type=SERVICIO`}>` button.
- Lines 273-279: filter `<SelectContent>` has two separate items: `"COMPRA_GENERAL"` → "Compra General" and `"SERVICIO"` → "Servicio".
- Line 94: filter logic `p.purchaseType !== typeFilter` — exact match.
- Line 337: `PURCHASE_TYPE_LABEL` maps both to their separate labels.

**Choice**: UI-only collapse. No schema change. No change to how records are stored or read.

Changes:
1. **Two entry cards → one card**. Replace both CG and SERVICIO cards with a single card titled `"Compra / Servicio"` whose button routes to `?type=COMPRA_GENERAL`. Keep the same icon vocabulary — suggest `ShoppingCart` (the existing CG icon) with its `bg-blue-100` color slot. Result: the top row shows 3 cards (Flete, Pollo Faenado, Compra/Servicio) on wide screens instead of 4 — update `grid-cols-2 lg:grid-cols-4` to `grid-cols-1 sm:grid-cols-3`.
2. **Filter select — two items → one item**. Replace the two `<SelectItem value="COMPRA_GENERAL">` and `<SelectItem value="SERVICIO">` with a single `<SelectItem value="COMPRA_GENERAL_O_SERVICIO">Compras y Servicios</SelectItem>`. Update the filter predicate:
    ```ts
    if (typeFilter !== "all") {
      if (typeFilter === "COMPRA_GENERAL_O_SERVICIO") {
        if (p.purchaseType !== "COMPRA_GENERAL" && p.purchaseType !== "SERVICIO") return false;
      } else if (p.purchaseType !== typeFilter) {
        return false;
      }
    }
    ```
3. **Type column label**. Update `PURCHASE_TYPE_LABEL`:
    ```ts
    const PURCHASE_TYPE_LABEL: Record<string, string> = {
      FLETE: "Flete",
      POLLO_FAENADO: "Pollo Faenado",
      COMPRA_GENERAL: "Compra / Servicio",
      SERVICIO: "Compra / Servicio",   // legacy rows render with merged label
    };
    ```
    Historical `SV-xxx` rows still render with their existing `displayCode` (line 347 reads `purchase.displayCode` which is stored on the row and not computed from the type) — zero change needed there.

No form change: `purchase-form.tsx` still accepts both `purchaseType` props and renders identically for them. The new entry path always creates `COMPRA_GENERAL`.

### D12. Unit tests — rewiring + new coverage

**Modified** — `components/purchases/__tests__/purchase-form-iva-gate.test.tsx`: the 4 existing tests target `getByRole("button", { name: /registrar libro de compras/i })` in the footer. After D8 the footer button is gone — rewire the tests to query the header LcvIndicator via `data-lcv-state` selector (same pattern as sales' `components/sales/__tests__/lcv-indicator.test.tsx` and its usage inside sale-form tests).

**New** — `components/purchases/__tests__/lcv-indicator-purchase.test.tsx`: optional regression tests for the `deriveLcvStatePurchase` helper. Lightweight — 3 tests covering S1/S2/S3 derivation.

**New** — `features/accounting/iva-books/__tests__/reactivate-purchase.test.ts`: repository + service integration. Mirror the existing `reactivate-sale.test.ts` if present — cover (a) success (VOIDED → ACTIVE + journal regen triggered), (b) guard (409 when already ACTIVE), (c) 404 when not found, (d) period CLOSED → throws `FISCAL_PERIOD_CLOSED`.

**New** — `features/purchase/__tests__/unlink-regenerates-journal.test.ts` + `reactivate-regenerates-journal.test.ts`: high-level check that after unlink the regenerated journal has NO IVA/IT lines, and after reactivate IVA+IT come back. Lift the existing sales equivalent (`iva-books.service.cascade.test.ts`) and adapt entity names.

**Out of scope** — no e2e. Pure unit + integration.

## Data Flow

```
Operator clicks S3 LcvIndicator in purchase-form header row 2
  └─> DropdownMenu opens
        ├─ "Editar"                   → setIvaModalOpen(true)
        │                                └─ IvaBookPurchaseModal mode="edit"
        │                                      └─ PATCH /iva-books/purchases/[entryId]
        └─ "Desvincular del LCV"      → setUnlinkDialogOpen(true)
                                         └─ confirm
                                             └─ PATCH /iva-books/purchases/[ivaBookId]/void
                                                 └─ IvaBooksService.voidPurchase
                                                     └─ maybeRegenerateJournal("purchase")
                                                         └─ PurchaseService.regenerateJournalForIvaChange
                                                             └─ journal rebuilt WITHOUT IVA/IT
                                                                 └─ router.refresh() → state = S2

Operator clicks S2 button when ivaPurchaseBook.status === "VOIDED"
  └─> setReactivateDialogOpen(true)
        └─ confirm
            └─ PATCH /iva-books/purchases/[ivaBookId]/reactivate (NEW)
                └─ IvaBooksService.reactivatePurchase (NEW)
                    └─ repo.reactivatePurchase (NEW)  ← status ACTIVE
                    └─ maybeRegenerateJournal("purchase")  ← journal rebuilt WITH IVA+IT
                        └─ router.refresh() → state = S3

Operator clicks S2 button when ivaPurchaseBook is null
  └─> setIvaModalOpen(true)  (mode="create-from-source")
        └─ POST /iva-books/purchases
            └─ router.refresh() → state = S3
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `components/common/lcv-indicator.tsx` | Move | From `components/sales/lcv-indicator.tsx` — same content, new path |
| `components/sales/sale-form.tsx` | Modify | Update import path to `@/components/common/lcv-indicator` (one-line change) |
| `components/purchases/purchase-form.tsx` | Modify | Row-2 LcvIndicator + dialogs wiring, remove footer LCV button, bottom-row grid for Notas + CxP, CxP flex refactor, modal `mode` + `entryId` VOIDED-aware fix |
| `components/purchases/use-lcv-unlink-purchase.ts` | Create | Thin fetch wrapper + toast + router.refresh() |
| `components/purchases/use-lcv-reactivate-purchase.ts` | Create | Thin fetch wrapper + toast + router.refresh() |
| `components/purchases/unlink-lcv-confirm-dialog-purchase.tsx` | Create | Spanish confirm dialog, destructive primary button |
| `components/purchases/reactivate-lcv-confirm-dialog-purchase.tsx` | Create | Spanish confirm dialog, default primary button |
| `components/purchases/purchase-list.tsx` | Modify | Merge CG+SERVICIO entry cards, filter items, type labels (Sub-task B) |
| `app/api/organizations/[orgSlug]/iva-books/purchases/[id]/reactivate/route.ts` | Create | PATCH route mirroring sales equivalent |
| `features/accounting/iva-books/iva-books.service.ts` | Modify | Add `reactivatePurchase(orgId, userId, id)` |
| `features/accounting/iva-books/iva-books.repository.ts` | Modify | Add `reactivatePurchase(orgId, id)` |
| `components/purchases/__tests__/purchase-form-iva-gate.test.tsx` | Modify | Rewire 4 tests for header LcvIndicator location |
| `features/accounting/iva-books/__tests__/reactivate-purchase.test.ts` | Create | Repo + service integration |
| `features/purchase/__tests__/unlink-regenerates-journal.test.ts` | Create | Regression: unlink → no IVA/IT |
| `features/purchase/__tests__/reactivate-regenerates-journal.test.ts` | Create | Regression: reactivate → IVA/IT restored |
| `prisma/schema.prisma` | Untouched | No migration; `SERVICIO` stays in enum |

## Interfaces / Contracts

### `LcvIndicator` (relocated, unchanged API)
```ts
type LcvState = "S1" | "S2" | "S3";
interface LcvIndicatorProps {
  state: LcvState;
  periodOpen: boolean;
  onRegister?: () => void;
  onEdit?: () => void;
  onUnlink?: () => void;
}
```

### `IvaBooksRepository.reactivatePurchase`
```ts
reactivatePurchase(orgId: string, id: string): Promise<IvaPurchaseBookDTO>;
// Throws NotFoundError if not found; ConflictError if status !== VOIDED.
// Updates: only `status = "ACTIVE"`.
```

### `IvaBooksService.reactivatePurchase`
```ts
reactivatePurchase(
  orgId: string,
  userId: string,
  id: string,
): Promise<IvaPurchaseBookDTO>;
// Calls repo.reactivatePurchase, then maybeRegenerateJournal("purchase", purchaseId, ...).
// May throw FISCAL_PERIOD_CLOSED if purchase is POSTED and period is CLOSED.
```

### `PATCH /api/organizations/[orgSlug]/iva-books/purchases/[id]/reactivate`
```
id = IvaPurchaseBook.id (not Purchase.id)
auth: Clerk session + org access + role in { owner, admin, contador }
200 → IvaPurchaseBookDTO (status = ACTIVE)
401 → no session
403 → no org access / wrong role
404 → entry not found
409 → already ACTIVE
```

### Unlink hook
```ts
useLcvUnlinkPurchase(
  orgSlug: string,
  ivaBookId: string | undefined,
): { handleUnlink: () => Promise<void>; isPending: boolean };
```

### Reactivate hook
```ts
useLcvReactivatePurchase(
  orgSlug: string,
  ivaBookId: string | undefined,
): { handleReactivate: () => Promise<void>; isPending: boolean };
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `deriveLcvStatePurchase` S1/S2/S3 cases | Vitest — pure function, straight input/output |
| Unit | `<LcvIndicator>` (post-move) still renders S1/S2/S3 with correct `data-lcv-state` | Existing sales tests already cover this; update import path in the test file if it lives in `components/sales/__tests__/` |
| Unit | Dialogs render copy + call `onConfirm` when primary clicked | RTL: `getByText(/desvincular del libro de compras/i)` and `fireEvent.click` |
| Integration | `IvaBooksRepository.reactivatePurchase` | Prisma test db: seed VOIDED row, call, assert status = ACTIVE, assert ConflictError when already ACTIVE |
| Integration | `IvaBooksService.reactivatePurchase` triggers journal regen with IVA+IT | Mock `PurchaseServiceForBridge` + assert `regenerateJournalForIvaChange` called once; test FISCAL_PERIOD_CLOSED path |
| Integration | `PATCH .../reactivate` route | Test with authed + unauthed + wrong-role requests, validate 200/401/403/404/409 |
| UI gate | Existing `purchase-form-iva-gate.test.tsx` | Rewrite queries to target header LcvIndicator via `data-lcv-state` |
| Regression | Unlink → journal without IVA/IT | Extend existing sale equivalent for purchase side |
| Regression | Reactivate → journal with IVA/IT | New test mirroring the above |

No `@testing-library/user-event` — per AGENTS, use `fireEvent.pointerDown + click` for Radix triggers.

## Migration / Rollout

- **No DB migration** — purely code.
- **No feature flag** — the new LcvIndicator replaces the footer button atomically; ship sub-task A as one or two commits, then sub-task B as a separate commit.
- **Rollback**: revert commits. The `reactivatePurchase` endpoint is additive — leaving it deployed after revert is harmless (nothing calls it anymore).
- **Sub-task B rollback**: restore the two `<Card>` entry blocks and the two filter items. `COMPRA_GENERAL` rows created while the merged UI was live remain valid `COMPRA_GENERAL` records — no data rewrite needed.

## Open Questions

None. Scope is locked: two sub-tasks, Option C rejected, all five pieces have 1:1 sales analogs already on disk.
