# purchase-list-ui Specification (Delta)

## Purpose

Describes changes to `purchase-list.tsx`: collapsing the "Compra General" and "Servicios" entry points into a single unified button and filter label, while preserving full read access to historical `SV-xxx` records.

---

## ADDED Requirements

### REQ-C.1 — Unified "Compras y Servicios" Entry Button

The purchase list MUST replace the two separate entry buttons ("Nueva Compra General" and "Nuevo Servicio") with a single "Nueva Compra / Servicio" button. This button MUST route to the purchase form with `?type=COMPRA_GENERAL` as the default purchase type. No new `SERVICIO`-typed records will be created via this UI; existing `SV-xxx` records remain readable.

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

The purchase list filter (by purchase type) MUST collapse the separate "Compra General" and "Servicios" filter options into a single "Compras y Servicios" option. This unified option MUST return records matching either `COMPRA_GENERAL` OR `SERVICIO` from the database. Other purchase types (FLETE, POLLO_FAENADO, etc.) remain as separate filter options and are NOT affected.

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
