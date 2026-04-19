# purchase-form-ui Specification (Delta)

## Purpose

Describes changes to the Purchase form UI: LCV indicator promotion to header, unlink-from-LCV flow, reactivate flow, and layout adjustments to the Notas and Resumen de Pagos (CxP) sections. LCV here refers to Libro de Compras (IvaPurchaseBook).

---

## ADDED Requirements

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

## REMOVED Requirements

### Requirement: "Registrar Libro de Compras" Footer Button

(Reason: Replaced by the LCV indicator in header row 2. The footer action bar MUST NOT contain the "Registrar Libro de Compras" button after this change.)
