# Spec: Sales & Dispatch Forms UX — LCV indicator + layout polish

## Change: `sales-dispatch-forms-ux`

---

## Domain: sale-form-ui

### REQ-A.1 — LCV Indicator in Header

The sale form header row 2 MUST display `<LcvIndicator>` alongside Cliente and Total. Status derived from `(isEditMode, sale.id, sale.ivaSalesBook)`.

#### Scenario: Header shows indicator for saved sale without LCV

- GIVEN a saved sale with no linked IvaSalesBook
- WHEN header row 2 renders
- THEN LCV indicator is visible next to Total in S2 state

#### Scenario: Header shows indicator for unsaved/draft sale

- GIVEN a new sale not yet saved
- WHEN header row 2 renders
- THEN LCV indicator is visible, disabled (S1 state), no interaction

---

### REQ-A.2 — LCV Indicator State Machine

`<LcvIndicator>` MUST implement three states:

| State | Condition | Appearance | Interaction |
|-------|-----------|------------|-------------|
| S1 | draft/unsaved | Grey, disabled | None |
| S2 | saved, no IvaSalesBook | Neutral | Opens register-in-LCV flow |
| S3 | saved, IvaSalesBook present | Emerald (distinct from CTA green) | Opens Edit + Unlink popover |

#### Scenario: S1 — indicator non-interactive in draft

- GIVEN sale form in create mode (no `sale.id`)
- WHEN indicator renders
- THEN no click/keyboard event triggers any action

#### Scenario: S2 — click opens register flow

- GIVEN saved sale with no IvaSalesBook
- WHEN user clicks LCV indicator
- THEN existing register-in-LCV modal opens; form state unchanged

#### Scenario: S3 — emerald color distinct from CTA

- GIVEN saved sale with linked IvaSalesBook
- WHEN indicator renders
- THEN shown with emerald-50 background / emerald-700 border, NOT the primary CTA color token

#### Scenario: S3 — click reveals Edit + Unlink

- GIVEN saved sale with linked IvaSalesBook
- WHEN user clicks S3 indicator
- THEN popover appears with "Editar registro LCV" and "Desvincular del Libro de Ventas"

---

### REQ-A.3 — Unlink from LCV

The unlink action MUST: (1) show a confirmation modal with copy distinguishing it from "Anular venta"; (2) on confirm, call void path which deletes IvaSalesBook and regenerates journal WITHOUT IVA/IT lines; (3) leave the sale record unchanged.

#### Scenario: Confirmation modal shown before unlink

- GIVEN user clicks "Desvincular del Libro de Ventas" from S3 popover
- WHEN action is triggered
- THEN confirmation modal appears stating the sale itself is preserved
- AND modal does NOT use the word "Anular"

#### Scenario: Confirmed unlink removes IvaSalesBook, journal has no IVA/IT

- GIVEN confirmation modal is open
- WHEN user confirms
- THEN `IvaBooksService.voidSale(orgId, userId, ivaBookId)` is called
- AND resulting journal entry contains NO IVA lines and NO IT lines
- AND sale record (amounts, lines, contact) is unchanged

#### Scenario: Cancelled unlink is a no-op

- GIVEN confirmation modal is open
- WHEN user cancels or closes modal
- THEN IvaSalesBook and journal entry are unchanged; indicator remains S3

---

### REQ-A.4 — Notas Relocated to Bottom Row

"Notas (opcional)" MUST share a bottom row with "Resumen de Cobros (CxC)" in `sale-form.tsx`.

#### Scenario: Side-by-side at sm and above

- GIVEN viewport `sm:` or wider
- WHEN sale form renders
- THEN Notas and Resumen de Cobros appear side-by-side in the same row

#### Scenario: Single-column below sm

- GIVEN viewport smaller than `sm:`
- WHEN sale form renders
- THEN Notas and Resumen de Cobros stack vertically

---

### REQ-A.5 — Resumen de Cobros Right-Aligned

Payment detail rows in "Resumen de Cobros (CxC)" MUST be right-aligned. Description and amount SHOULD be tightly grouped on the right.

#### Scenario: Payment rows flush right

- GIVEN sale form with payment lines in Resumen de Cobros
- WHEN block renders
- THEN description and amount pairs are flush to the right with no wide gap

---

### REMOVED — "Registrar Libro de Ventas" Footer Button

(Reason: Replaced by LCV indicator in header row 2. Footer action bar MUST NOT contain this button after this change.)

---

## Domain: dispatch-form-ui

### REQ-B.1 — Notas Relocated in NOTA_DE_DESPACHO

"Notas (opcional)" MUST share a bottom row with "Resumen de Cobros" in the NDD variant.

#### Scenario: Side-by-side at sm and above (NDD)

- GIVEN NDD variant on viewport `sm:` or wider
- WHEN form renders
- THEN Notas and Resumen de Cobros appear side-by-side

#### Scenario: Single-column below sm (NDD)

- GIVEN NDD variant on viewport smaller than `sm:`
- WHEN form renders
- THEN Notas and Resumen de Cobros stack vertically

---

### REQ-B.2 — Notas Relocated in BOLETA_CERRADA

"Notas (opcional)" MUST share a bottom row with "Resumen de Cobros" in the BC variant.

#### Scenario: Side-by-side at sm and above (BC)

- GIVEN BC variant on viewport `sm:` or wider
- WHEN form renders
- THEN Notas and Resumen de Cobros appear side-by-side

#### Scenario: Single-column below sm (BC)

- GIVEN BC variant on viewport smaller than `sm:`
- WHEN form renders
- THEN Notas and Resumen de Cobros stack vertically

---

### REQ-B.3 — Resumen de Cobros Right-Aligned (Both Variants)

Payment detail rows MUST be right-aligned in both NDD and BC dispatch variants.

#### Scenario: Payment rows flush right (NDD)

- GIVEN NDD variant with payment lines
- WHEN Resumen de Cobros renders
- THEN description and amount are flush to the right

#### Scenario: Payment rows flush right (BC)

- GIVEN BC variant with payment lines
- WHEN Resumen de Cobros renders
- THEN description and amount are flush to the right

---

### Non-Applicability: LCV in Dispatch Forms

LCV (IvaSalesBook) logic MUST NOT be applied to any dispatch form variant. No LCV indicator, no unlink flow, no LCV footer button.
