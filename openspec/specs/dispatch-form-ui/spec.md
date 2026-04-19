# dispatch-form-ui Specification (Delta)

## Purpose

Describes layout changes to the Dispatch form UI for the `NOTA_DE_DESPACHO` and `BOLETA_CERRADA` variants: Notas field relocation and Resumen de Cobros right-alignment. LCV logic does NOT apply to dispatch forms.

---

## ADDED Requirements

### Requirement: Notas Field Relocated in NOTA_DE_DESPACHO Variant

In `dispatch-form.tsx` for the `NOTA_DE_DESPACHO` variant, the "Notas (opcional)" field MUST be relocated to share a bottom row with "Resumen de Cobros".

#### Scenario: Notas and Resumen share a row at sm and above (NDD)

- GIVEN the dispatch form is rendering the `NOTA_DE_DESPACHO` variant on a viewport `sm:` or wider
- WHEN the form renders
- THEN "Notas (opcional)" and "Resumen de Cobros" appear side-by-side in the same bottom row

#### Scenario: Single-column collapse below sm breakpoint (NDD)

- GIVEN the dispatch form is rendering the `NOTA_DE_DESPACHO` variant on a viewport smaller than `sm:`
- WHEN the form renders
- THEN "Notas (opcional)" and "Resumen de Cobros" stack vertically in a single column

---

### Requirement: Notas Field Relocated in BOLETA_CERRADA Variant

In `dispatch-form.tsx` for the `BOLETA_CERRADA` variant, the "Notas (opcional)" field MUST be relocated to share a bottom row with "Resumen de Cobros".

#### Scenario: Notas and Resumen share a row at sm and above (BC)

- GIVEN the dispatch form is rendering the `BOLETA_CERRADA` variant on a viewport `sm:` or wider
- WHEN the form renders
- THEN "Notas (opcional)" and "Resumen de Cobros" appear side-by-side in the same bottom row

#### Scenario: Single-column collapse below sm breakpoint (BC)

- GIVEN the dispatch form is rendering the `BOLETA_CERRADA` variant on a viewport smaller than `sm:`
- WHEN the form renders
- THEN "Notas (opcional)" and "Resumen de Cobros" stack vertically in a single column

---

### Requirement: Resumen de Cobros Right-Aligned (Both Variants)

In `dispatch-form.tsx` for both `NOTA_DE_DESPACHO` and `BOLETA_CERRADA` variants, the payment detail rows inside "Resumen de Cobros" MUST be right-aligned.

#### Scenario: Payment rows are right-aligned in NDD

- GIVEN the dispatch form is rendering the `NOTA_DE_DESPACHO` variant with payment lines
- WHEN the Resumen de Cobros block renders
- THEN payment description and amount pairs are flush to the right of the container

#### Scenario: Payment rows are right-aligned in BC

- GIVEN the dispatch form is rendering the `BOLETA_CERRADA` variant with payment lines
- WHEN the Resumen de Cobros block renders
- THEN payment description and amount pairs are flush to the right of the container

---

## Non-Applicability

LCV (Libro de Ventas / IvaSalesBook) logic MUST NOT be applied to any dispatch form variant. Dispatch documents do not link to `IvaSalesBook`. No LCV indicator, no unlink flow, no LCV footer button shall exist in `dispatch-form.tsx`.
