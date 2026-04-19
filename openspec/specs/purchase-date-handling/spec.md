# Spec: purchase-date-handling

## Change: `fix-comprobante-date-tz`

---

## Domain: `purchase-date-handling`

---

### REQ-D.1 — `purchase-form.tsx` default date uses `todayLocal()`

In `components/purchases/purchase-form.tsx`, the `useState` initializer that sets the default `date` when creating a new purchase MUST use `todayLocal()` from `lib/date-utils.ts` instead of `new Date().toISOString().split("T")[0]`. This applies to both the primary `date` field (line 213-215) and the FLETE detail `fecha` re-fill (line 241) that also uses the same UTC-based pattern.

**Affected locations**: `purchase-form.tsx:213-215` (main date), `purchase-form.tsx:241` (FLETE `fecha` re-fill).

#### Scenario: New purchase form opened at 21:00 Bolivia time defaults to local calendar day

- GIVEN the user opens `purchase-form` in create mode
- AND the system clock is at 2026-04-17T21:00:00 local Bolivia time (= 2026-04-18T01:00:00Z)
- WHEN the form initializes its `date` state
- THEN the `<input type="date">` value is `"2026-04-17"`
- AND it is NOT `"2026-04-18"`

#### Scenario: FLETE detail `fecha` re-fill also uses correct local day

- GIVEN the user opens `purchase-form` in create mode for a FLETE-type purchase at 21:00 Bolivia time
- WHEN the FLETE detail `fecha` field is initialized
- THEN its value is `"2026-04-17"`
- AND it is NOT `"2026-04-18"`

---

### REQ-D.2 — `purchase-form.tsx` display calls route through `formatDateBO`

All date display expressions in `components/purchases/purchase-form.tsx` that currently call `new Date(x).toLocaleDateString("es-BO")` MUST be replaced with `formatDateBO(x)`.

**Affected locations**:
- `purchase-form.tsx:683` — read-only `Fecha` header when viewing a saved purchase
- `purchase-form.tsx:1464` — `payment.date` display inside the pago allocation summary

Additionally, `components/purchases/purchase-list.tsx` MUST replace its list-row date display with `formatDateBO`.

#### Scenario: Read-only fecha header shows correct calendar day for UTC-midnight record

- GIVEN a purchase was saved with `date` stored as `2026-04-17T00:00:00.000Z`
- WHEN the user opens that purchase in view/edit mode and the form renders the read-only `Fecha` field
- THEN the displayed value is `"17/04/2026"`
- AND it is NOT `"16/04/2026"`

#### Scenario: Pago allocation payment.date shows correct calendar day

- GIVEN a purchase has a pago allocation entry with `payment.date` stored as `2026-04-17T00:00:00.000Z`
- WHEN the pago allocation summary renders inside `purchase-form`
- THEN the payment date column shows `"17/04/2026"`
- AND it is NOT `"16/04/2026"`

#### Scenario: Purchase list row shows correct date for UTC-midnight record

- GIVEN `purchase-list.tsx` fetches a purchase with `date = "2026-04-17T00:00:00.000Z"`
- WHEN the list row renders (using `formatDateBO` after the replacement)
- THEN the date cell shows `"17/04/2026"`
- AND it is NOT `"16/04/2026"`

---

### REQ-D.3 — `purchase.repository.ts` normalizes dates to noon UTC on create and update

In `features/purchase/purchase.repository.ts`, both the `create` path (line 186) and the `update` path (line 249) MUST store dates as `new Date(input.date + "T12:00:00.000Z")` instead of `new Date(input.date)`.

**Affected locations**: `purchase.repository.ts:186` (create), `purchase.repository.ts:249` (update).

#### Scenario: Creating a purchase stores date at noon UTC

- GIVEN a purchase create payload with `date: "2026-04-17"`
- WHEN `PurchaseRepository.create(input)` is called
- THEN the value written to the database is `2026-04-17T12:00:00.000Z`
- AND it is NOT `2026-04-17T00:00:00.000Z`

#### Scenario: Updating a purchase stores date at noon UTC

- GIVEN a purchase update payload with `date: "2026-04-17"`
- WHEN `PurchaseRepository.update(id, input)` is called
- THEN the value written to the database is `2026-04-17T12:00:00.000Z`
- AND it is NOT `2026-04-17T00:00:00.000Z`

#### Scenario: Noon-UTC stored value round-trips correctly through formatDateBO display

- GIVEN `purchase.repository.ts` stored `2026-04-17T12:00:00.000Z` for a purchase
- WHEN the API serializes the record and `formatDateBO` renders it in the list or form
- THEN the displayed date is `"17/04/2026"`
