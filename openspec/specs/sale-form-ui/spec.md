# sale-form-ui Specification (Delta)

## Purpose

Describes changes to the Sale form UI: LCV indicator promotion to header, unlink-from-LCV flow, and layout adjustments to the Notas and Resumen de Cobros sections.

---

## ADDED Requirements

### Requirement: LCV Indicator in Header

The sale form header row 2 MUST display a `<LcvIndicator>` component alongside Cliente and Total. The indicator MUST derive its visual state from `(isEditMode, sale.id, sale.ivaSalesBook)` and render one of three states: S1 (draft/unsaved), S2 (saved, no IvaSalesBook), S3 (saved, IvaSalesBook present).

#### Scenario: Header shows LCV indicator when form loads saved sale

- GIVEN the user opens a saved sale with no linked IvaSalesBook
- WHEN the header row 2 renders
- THEN the LCV indicator is visible next to Total
- AND it shows the S2 (unregistered) state

#### Scenario: Header shows LCV indicator for unsaved/draft sale

- GIVEN the user creates a new sale that has not been saved yet
- WHEN the header row 2 renders
- THEN the LCV indicator is visible
- AND it is visually disabled (S1 state) with no interactive affordance

---

### Requirement: LCV Indicator State Machine

The `<LcvIndicator>` MUST implement exactly three visual states:

| State | Condition | Appearance | Interaction |
|-------|-----------|------------|-------------|
| S1 | `!isEditMode` (draft/unsaved) | Grey, disabled | None |
| S2 | `isEditMode && !sale.ivaSalesBook` | Default/neutral | Click opens register-in-LCV flow |
| S3 | `isEditMode && sale.ivaSalesBook` | Emerald (distinct from save-CTA green) | Click opens popover with Edit + Unlink options |

#### Scenario: S1 — draft sale, indicator is locked

- GIVEN the sale form is in create mode (no `sale.id`)
- WHEN the LCV indicator renders
- THEN the indicator is non-interactive and visually greyed out
- AND no click or keyboard event triggers any action

#### Scenario: S2 — saved sale without LCV, click opens register flow

- GIVEN a saved sale with no linked `IvaSalesBook`
- WHEN the user clicks the LCV indicator
- THEN the existing register-in-LCV modal opens
- AND the form's other state is unchanged

#### Scenario: S3 — saved sale with LCV, emerald color distinct from CTA

- GIVEN a saved sale with a linked `IvaSalesBook`
- WHEN the LCV indicator renders
- THEN it is displayed in emerald-50 background with emerald-700 border
- AND it does NOT use the same color token as the primary "Guardar y contabilizar" CTA

#### Scenario: S3 — click reveals Edit and Unlink options

- GIVEN a saved sale with a linked `IvaSalesBook`
- WHEN the user clicks the S3 LCV indicator
- THEN a popover or menu appears with two options: "Editar registro LCV" and "Desvincular del Libro de Ventas"

---

### Requirement: Unlink from LCV (Confirmation + Action)

The system MUST provide an unlink action that: (1) shows a confirmation modal with copy that explicitly distinguishes from "Anular venta", (2) on confirm calls the void path which deletes `IvaSalesBook` and triggers journal regeneration without IVA/IT lines, (3) leaves the sale row (amounts, lines, contact) unchanged.

#### Scenario: Unlink confirmation modal shown before action

- GIVEN the user clicks "Desvincular del Libro de Ventas" from the S3 popover
- WHEN the action is triggered
- THEN a confirmation modal appears
- AND the modal copy explicitly states that the sale itself is preserved (only the LCV registration is removed)
- AND the modal does NOT use the word "Anular"

#### Scenario: Confirmed unlink removes IvaSalesBook and regenerates journal without IVA/IT

- GIVEN the confirmation modal is open for an unlink action
- WHEN the user confirms
- THEN `IvaBooksService.voidSale(orgId, userId, ivaBookId)` is called
- AND the resulting journal entry for the sale contains NO IVA lines and NO IT lines
- AND the sale record (amounts, lines, contact) is unchanged

#### Scenario: Cancelled unlink leaves everything unchanged

- GIVEN the confirmation modal is open
- WHEN the user clicks "Cancelar" or closes the modal
- THEN no changes are made to `IvaSalesBook` or the journal entry
- AND the LCV indicator remains in S3 state

---

### Requirement: Notas Field Relocated to Bottom Row

In `sale-form.tsx`, the "Notas (opcional)" field MUST be relocated from its current mid-form position to a bottom row that it shares with "Resumen de Cobros (CxC)".

#### Scenario: Notas and Resumen Cobros share a row at sm and above

- GIVEN the user views a sale form on a viewport `sm:` or wider
- WHEN the form renders
- THEN "Notas (opcional)" and "Resumen de Cobros (CxC)" appear side-by-side in the same row
- AND no other field occupies that row

#### Scenario: Single-column layout below sm breakpoint

- GIVEN the user views a sale form on a viewport smaller than `sm:`
- WHEN the form renders
- THEN "Notas (opcional)" and "Resumen de Cobros (CxC)" stack vertically in a single column

---

### Requirement: Resumen de Cobros Right-Aligned

In `sale-form.tsx`, the payment detail rows inside "Resumen de Cobros (CxC)" MUST be right-aligned. Description labels and amount values SHOULD be tightly grouped on the right side, not stretched across the full width.

#### Scenario: Payment rows are right-aligned

- GIVEN a sale form with one or more payment lines in Resumen de Cobros
- WHEN the block renders
- THEN payment description and amount pairs appear flush to the right of the container
- AND there is no wide gap between description and amount

---

## REMOVED Requirements

### Requirement: "Registrar Libro de Ventas" Footer Button

(Reason: Replaced by the LCV indicator in header row 2. The footer action bar MUST NOT contain the "Registrar Libro de Ventas" button after this change.)
