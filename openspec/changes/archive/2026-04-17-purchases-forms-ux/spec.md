# Spec: Purchases Forms UX — LCV indicator + CG/SERVICIO unification

## Change: `purchases-forms-ux`

---

## Domain: purchase-form-ui

### REQ-A.1 — LCV Indicator in Header

The purchase form header row 2 MUST display a `<LcvIndicator>` component alongside Proveedor and Total. The indicator MUST derive its visual state from `(isEditMode, purchase.ivaPurchaseBook, ivaPurchaseBook.status)` and render one of three states: S1 (draft/unsaved), S2 (saved, no linked IvaPurchaseBook), S3 (saved, IvaPurchaseBook present and ACTIVE).

#### Scenario: Header shows indicator for saved purchase without LCV

- GIVEN the user opens a saved purchase with no linked `IvaPurchaseBook`
- WHEN header row 2 renders
- THEN the LCV indicator is visible next to Total
- AND it shows the S2 (unregistered) state

#### Scenario: Header shows indicator for unsaved/draft purchase

- GIVEN the user creates a new purchase that has not been saved yet
- WHEN header row 2 renders
- THEN the LCV indicator is visible
- AND it is visually disabled (S1 state) with no interactive affordance

#### Scenario: Header shows emerald indicator for purchase with active LCV

- GIVEN the user opens a saved purchase with a linked `IvaPurchaseBook` in ACTIVE status
- WHEN header row 2 renders
- THEN the LCV indicator is visible in S3 (emerald) state next to Total

---

### REQ-A.2 — LCV Indicator State Machine

`<LcvIndicator>` MUST implement exactly three visual states:

| State | Condition | Appearance | Interaction |
|-------|-----------|------------|-------------|
| S1 | `!isEditMode` (draft/unsaved) | Grey, disabled | None |
| S2 | `isEditMode && !purchase.ivaPurchaseBook` | Default/neutral | Click opens register-in-LCV modal |
| S3 | `isEditMode && purchase.ivaPurchaseBook && status === ACTIVE` | Emerald (distinct from save-CTA green) | Click opens popover with Edit + Unlink options |

The component MAY be the same `<LcvIndicator>` used in the sale form, generalized to accept a domain discriminator or made fully domain-agnostic via props. The component MUST NOT be forked.

#### Scenario: S1 — draft purchase, indicator is locked

- GIVEN the purchase form is in create mode (no persisted `purchase.id`)
- WHEN the LCV indicator renders
- THEN the indicator is non-interactive and visually greyed out
- AND no click or keyboard event triggers any action

#### Scenario: S2 — saved purchase without LCV, click opens register flow

- GIVEN a saved purchase with no linked `IvaPurchaseBook`
- WHEN the user clicks the LCV indicator
- THEN the existing register-in-LCV modal opens
- AND the form's other state is unchanged

#### Scenario: S3 — emerald color distinct from save CTA

- GIVEN a saved purchase with a linked `IvaPurchaseBook` in ACTIVE status
- WHEN the LCV indicator renders
- THEN it is displayed in emerald-50 background with emerald-700 border
- AND it does NOT use the same color token as the primary "Guardar y contabilizar" CTA

#### Scenario: S3 — click reveals Edit and Unlink options

- GIVEN a saved purchase with a linked `IvaPurchaseBook` in ACTIVE status
- WHEN the user clicks the S3 LCV indicator
- THEN a popover or menu appears with at minimum: "Editar registro LCV" and "Desvincular del Libro de Compras"

---

### REQ-A.3 — Unlink from LCV (Confirmation + Action)

The unlink action MUST: (1) show a confirmation dialog with copy that explicitly distinguishes from "Anular compra"; (2) on confirm, call `PATCH .../iva-books/purchases/[id]/void` which marks the `IvaPurchaseBook` as VOIDED and regenerates the journal WITHOUT IVA/IT lines; (3) leave the purchase record (amounts, lines, supplier) unchanged.

#### Scenario: Confirmation dialog shown before unlink

- GIVEN the user clicks "Desvincular del Libro de Compras" from the S3 popover
- WHEN the action is triggered
- THEN a confirmation dialog appears
- AND the dialog copy explicitly states that the purchase itself is preserved (only the LCV registration is removed)
- AND the dialog does NOT use the word "Anular"

#### Scenario: Confirmed unlink calls void endpoint and indicator transitions to S2

- GIVEN the confirmation dialog is open for an unlink action
- WHEN the user confirms
- THEN `PATCH /api/organizations/[orgSlug]/iva-books/purchases/[id]/void` is called
- AND on success the LCV indicator transitions to S2 state
- AND the purchase record (amounts, lines, supplier) is unchanged

#### Scenario: Confirmed unlink — journal regenerated without IVA/IT lines

- GIVEN an active `IvaPurchaseBook` linked to a purchase that has IVA and IT journal lines
- WHEN the unlink is confirmed and the void completes
- THEN the resulting journal entry for the purchase contains NO IVA lines and NO IT lines

#### Scenario: Cancelled unlink leaves everything unchanged

- GIVEN the confirmation dialog is open
- WHEN the user clicks "Cancelar" or closes the dialog
- THEN no changes are made to `IvaPurchaseBook` or the journal entry
- AND the LCV indicator remains in S3 state

---

### REQ-A.4 — Reactivate from VOIDED LCV (Confirmation + Action)

When a purchase's `IvaPurchaseBook` is in VOIDED status (post-unlink), the LCV indicator MUST expose a "Reactivar registro LCV" action. On confirm it MUST call `PATCH .../iva-books/purchases/[id]/reactivate`, which restores status to ACTIVE and regenerates the journal WITH IVA/IT lines.

#### Scenario: VOIDED LCV shows Reactivate option in indicator menu

- GIVEN a saved purchase whose `IvaPurchaseBook` has status VOIDED
- WHEN the user opens the LCV indicator menu
- THEN the option "Reactivar registro LCV" is visible and interactive

#### Scenario: Confirmation dialog shown before reactivate

- GIVEN the user clicks "Reactivar registro LCV"
- WHEN the action is triggered
- THEN a confirmation dialog appears
- AND the dialog copy indicates the LCV registration will be restored and journal will be updated

#### Scenario: Confirmed reactivate calls reactivate endpoint and transitions to S3

- GIVEN the confirmation dialog is open for a reactivate action
- WHEN the user confirms
- THEN `PATCH /api/organizations/[orgSlug]/iva-books/purchases/[id]/reactivate` is called
- AND on success the LCV indicator transitions to S3 (emerald) state

#### Scenario: Confirmed reactivate — journal regenerated with IVA and IT lines

- GIVEN an `IvaPurchaseBook` in VOIDED status for a purchase that originally had IVA and IT lines
- WHEN the reactivate is confirmed and the endpoint completes
- THEN the resulting journal entry for the purchase contains IVA lines and IT lines
- AND the purchase record (amounts, lines, supplier) is unchanged

#### Scenario: Cancelled reactivate leaves everything unchanged

- GIVEN the confirmation dialog for reactivate is open
- WHEN the user clicks "Cancelar" or closes the dialog
- THEN no changes are made to `IvaPurchaseBook` or the journal entry
- AND the LCV indicator remains in the VOIDED/unregistered state

---

### REQ-A.5 — Notas Field Relocated to Bottom Row

In `purchase-form.tsx`, the "Notas (opcional)" field MUST be relocated from its current mid-form position to a bottom row that it shares with "Resumen de Pagos (CxP)". Layout MUST use `grid-cols-1` on mobile and `sm:grid-cols-2` at the `sm:` breakpoint and above.

#### Scenario: Notas and Resumen de Pagos share a row at sm and above

- GIVEN the user views a purchase form on a viewport `sm:` or wider
- WHEN the form renders
- THEN "Notas (opcional)" and "Resumen de Pagos (CxP)" appear side-by-side in the same row
- AND no other field occupies that row

#### Scenario: Single-column layout below sm breakpoint

- GIVEN the user views a purchase form on a viewport smaller than `sm:`
- WHEN the form renders
- THEN "Notas (opcional)" and "Resumen de Pagos (CxP)" stack vertically in a single column

---

### REQ-A.6 — Resumen de Pagos Right-Aligned

In `purchase-form.tsx`, the payment detail rows inside "Resumen de Pagos (CxP)" MUST be right-aligned. The container MUST use `w-full` with rows structured as `flex justify-between items-start`, and amount values MUST carry `text-right`. Description labels and amount values MUST be tightly grouped on the right side, not stretched across the full width.

#### Scenario: Payment rows are right-aligned

- GIVEN a purchase form with one or more payment lines in Resumen de Pagos
- WHEN the block renders
- THEN payment description and amount pairs appear flush to the right of the container
- AND there is no wide gap between description and amount

#### Scenario: Container width fills available space

- GIVEN the Resumen de Pagos block renders
- WHEN inspecting layout
- THEN the block uses `w-full` and payment row items use `justify-between` so totals reach the right edge

---

### REMOVED — "Registrar Libro de Compras" Footer Button

(Reason: Replaced by LCV indicator in header row 2. The footer action bar MUST NOT contain this button after this change.)

---

## Domain: iva-purchase-book-domain

### REQ-B.1 — `reactivatePurchase` Service Method

`IvaBooksService` MUST expose a `reactivatePurchase(orgId: string, userId: string, id: string)` method that:
1. Delegates status flip to `repo.reactivatePurchase(orgId, id)`.
2. After a successful status flip, calls `maybeRegenerateJournal("purchase", purchaseId, orgId, userId)` to restore IVA and IT journal lines.
3. Returns the updated `IvaPurchaseBookDTO` with `status: "ACTIVE"`.
4. Throws `ConflictError` (propagated from the repository) if the entry is already ACTIVE.

#### Scenario: Service delegates to repo and triggers journal regeneration

- GIVEN `IvaBooksRepository.reactivatePurchase` is called and resolves a DTO with `status: "ACTIVE"`
- WHEN `IvaBooksService.reactivatePurchase(orgId, userId, id)` is invoked
- THEN `repo.reactivatePurchase` is called with `(orgId, id)`
- AND `maybeRegenerateJournal("purchase", purchaseId, orgId, userId)` is called once
- AND the method returns the DTO with `status: "ACTIVE"`

#### Scenario: Service propagates ConflictError when already ACTIVE

- GIVEN the `IvaPurchaseBook` entry has `status: "ACTIVE"`
- WHEN `IvaBooksService.reactivatePurchase` is called
- THEN a `ConflictError` is thrown with a message indicating the entry is already active
- AND `maybeRegenerateJournal` is NOT called

#### Scenario: Journal regeneration restores IVA and IT lines after reactivate

- GIVEN a purchase that originally had IVA and IT journal lines, whose `IvaPurchaseBook` was VOIDED
- WHEN `IvaBooksService.reactivatePurchase` completes successfully
- THEN the resulting journal entry contains IVA lines and IT lines
- AND the purchase record (amounts, lines) is unchanged

---

### REQ-B.2 — `reactivatePurchase` Repository Method

`IvaBooksRepository` MUST expose a `reactivatePurchase(orgId: string, id: string)` method that:
1. Looks up the `IvaPurchaseBook` row by `id` and `organizationId`.
2. Throws `NotFoundError` if not found.
3. Throws `ConflictError` if `status !== "VOIDED"` (guard against double-reactivate).
4. Updates `status` to `"ACTIVE"`. MUST NOT touch `estadoSIN` (orthogonal axis).
5. Returns the updated `IvaPurchaseBookDTO`.

#### Scenario: Successful reactivation of a VOIDED entry

- GIVEN an `IvaPurchaseBook` row exists with `status: "VOIDED"` for the given `orgId`
- WHEN `repo.reactivatePurchase(orgId, id)` is called
- THEN the row's `status` is updated to `"ACTIVE"`
- AND `estadoSIN` is unchanged
- AND the updated DTO is returned

#### Scenario: Throws NotFoundError for non-existent id

- GIVEN no `IvaPurchaseBook` row exists with the given `id` and `orgId`
- WHEN `repo.reactivatePurchase(orgId, id)` is called
- THEN a `NotFoundError` is thrown

#### Scenario: Throws ConflictError when status is already ACTIVE

- GIVEN an `IvaPurchaseBook` row exists with `status: "ACTIVE"`
- WHEN `repo.reactivatePurchase(orgId, id)` is called
- THEN a `ConflictError` is thrown with a message indicating the entry is already active
- AND the row is not modified

---

### REQ-B.3 — `PATCH /api/organizations/[orgSlug]/iva-books/purchases/[id]/reactivate` Route

A new API route MUST be created at `app/api/organizations/[orgSlug]/iva-books/purchases/[id]/reactivate/route.ts` that:
1. Accepts `PATCH` requests.
2. Resolves `orgId` from `orgSlug` and `userId` from the Clerk session.
3. Calls `IvaBooksService.reactivatePurchase(orgId, userId, id)`.
4. Returns `200 OK` with the updated `IvaPurchaseBookDTO` on success.
5. Returns `404` when `NotFoundError` is thrown.
6. Returns `409` when `ConflictError` is thrown.
7. Mirrors the structure of the existing sales reactivate route.

#### Scenario: PATCH reactivate returns 200 with updated DTO

- GIVEN a valid `orgSlug`, authenticated user, and an `IvaPurchaseBook` id with status VOIDED
- WHEN `PATCH /api/organizations/[orgSlug]/iva-books/purchases/[id]/reactivate` is called
- THEN the response is `200 OK`
- AND the body contains the `IvaPurchaseBookDTO` with `status: "ACTIVE"`

#### Scenario: PATCH reactivate returns 404 for unknown id

- GIVEN a valid `orgSlug`, authenticated user, and an id that does not exist
- WHEN `PATCH /api/organizations/[orgSlug]/iva-books/purchases/[id]/reactivate` is called
- THEN the response is `404 Not Found`

#### Scenario: PATCH reactivate returns 409 when already ACTIVE

- GIVEN a valid `orgSlug`, authenticated user, and an `IvaPurchaseBook` id with status ACTIVE
- WHEN `PATCH /api/organizations/[orgSlug]/iva-books/purchases/[id]/reactivate` is called
- THEN the response is `409 Conflict`

---

## Domain: purchase-list-ui

### REQ-C.1 — Unified "Compras y Servicios" Entry Button

The purchase list MUST replace the two separate entry buttons ("Nueva Compra General" and "Nuevo Servicio") with a single "Nueva Compra / Servicio" button. This button MUST route to the purchase form with `?type=COMPRA_GENERAL` as the default purchase type.

#### Scenario: Single entry button visible in list header

- GIVEN the user views `purchase-list.tsx`
- WHEN the list renders
- THEN exactly ONE entry button is visible in the header area (not two)
- AND its label is "Nueva Compra / Servicio" (or equivalent unified label)

#### Scenario: Unified button routes with COMPRA_GENERAL type

- GIVEN the user clicks the "Nueva Compra / Servicio" button
- WHEN the navigation occurs
- THEN the purchase form opens with `?type=COMPRA_GENERAL` in the query string
- AND the form accepts and saves the record as `COMPRA_GENERAL`

#### Scenario: Historical SV-xxx records remain visible in the list

- GIVEN the database contains existing `SERVICIO`-typed purchases with `SV-xxx` displayCodes
- WHEN the purchase list renders without an active type filter
- THEN the `SV-xxx` records are visible in the list
- AND their `displayCode` is unchanged (no rename)

---

### REQ-C.2 — Unified Filter Label "Compras y Servicios"

The purchase list filter (by purchase type) MUST collapse the separate "Compra General" and "Servicios" filter options into a single "Compras y Servicios" option. This unified option MUST return records matching either `COMPRA_GENERAL` OR `SERVICIO`. Other purchase types (FLETE, POLLO_FAENADO, etc.) remain as separate filter options and are NOT affected.

#### Scenario: Filter shows single "Compras y Servicios" option

- GIVEN the user opens the type filter in the purchase list
- WHEN the filter options render
- THEN there is ONE option covering both `COMPRA_GENERAL` and `SERVICIO` records
- AND there are NO separate "Compra General" and "Servicios" options

#### Scenario: Unified filter returns both COMPRA_GENERAL and SERVICIO records

- GIVEN the database contains purchases of type `COMPRA_GENERAL` and `SERVICIO`
- WHEN the user selects the "Compras y Servicios" filter option
- THEN the list shows records of BOTH types
- AND `FLETE` and `POLLO_FAENADO` records are excluded from results

#### Scenario: FLETE and POLLO_FAENADO filter options remain unchanged

- GIVEN the user opens the type filter
- WHEN the filter options render
- THEN `FLETE` and `POLLO_FAENADO` (and any other types) appear as their own separate filter options
- AND selecting them returns only records of that specific type

#### Scenario: Historical SV-xxx records appear under unified filter

- GIVEN the database contains `SERVICIO`-typed purchases with `SV-xxx` displayCodes
- WHEN the user selects the "Compras y Servicios" filter
- THEN the `SV-xxx` records appear in the filtered results
- AND their `displayCode` is still `SV-xxx` (unchanged by the filter)
