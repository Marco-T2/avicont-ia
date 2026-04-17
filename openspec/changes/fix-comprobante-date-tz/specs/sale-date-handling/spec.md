# Spec: sale-date-handling

## Change: `fix-comprobante-date-tz`

---

## Domain: `sale-date-handling`

### REQ-B.1 — `sale-form.tsx` default date uses `todayLocal()`

In `components/sales/sale-form.tsx`, the `useState` initializer that sets the default `date` when creating a new sale MUST use `todayLocal()` from `lib/date-utils.ts` instead of `new Date().toISOString().split("T")[0]`. The edit-mode re-fill (`new Date(sale.date).toISOString().split("T")[0]`) used as the `<input type="date">` value is safe per the exploration analysis and MUST NOT be changed.

**Affected location**: `sale-form.tsx:155-156` (the `else` branch of the `useState` initializer).

#### Scenario: New sale form opened at 21:00 Bolivia time defaults to local calendar day

- GIVEN the user opens `sale-form` in create mode
- AND the system clock is at 2026-04-17T21:00:00 local Bolivia time (= 2026-04-18T01:00:00Z)
- WHEN the form initializes its `date` state
- THEN the `<input type="date">` value is `"2026-04-17"`
- AND it is NOT `"2026-04-18"`

#### Scenario: New sale form opened at 08:00 Bolivia time defaults to correct day

- GIVEN the user opens `sale-form` in create mode
- AND the system clock is at 2026-04-17T08:00:00 local Bolivia time
- WHEN the form initializes its `date` state
- THEN the `<input type="date">` value is `"2026-04-17"`

---

### REQ-B.2 — `sale-form.tsx` display calls route through `formatDateBO`

All date display expressions in `components/sales/sale-form.tsx` that currently call `new Date(x).toLocaleDateString("es-BO")` MUST be replaced with `formatDateBO(x)`.

**Affected locations**:
- `sale-form.tsx:545` — read-only `Fecha` header when viewing a saved sale
- `sale-form.tsx:888` — `payment.date` display inside the cobro allocation summary

#### Scenario: Read-only fecha header shows correct calendar day for UTC-midnight record

- GIVEN a sale was saved with `date` stored as `2026-04-17T00:00:00.000Z`
- WHEN the user opens that sale in view/edit mode and the form renders the read-only `Fecha` field
- THEN the displayed value is `"17/04/2026"`
- AND it is NOT `"16/04/2026"`

#### Scenario: Cobro allocation payment.date shows correct calendar day

- GIVEN a sale has a payment allocation entry with `payment.date` stored as `2026-04-17T00:00:00.000Z`
- WHEN the cobro allocation summary renders
- THEN the payment date column shows `"17/04/2026"`
- AND it is NOT `"16/04/2026"`

---

### REQ-B.3 — `sale-list.tsx::formatDate` uses `formatDateBO`

In `components/sales/sale-list.tsx`, the `formatDate` helper (or equivalent inline expression at line 56) that formats sale dates for list rows MUST use `formatDateBO` instead of `new Date(date).toLocaleDateString("es-BO", {...})`.

**Affected location**: `sale-list.tsx:56`.

#### Scenario: Sale list row shows correct date for UTC-midnight record

- GIVEN the sale list fetches a sale with `date = "2026-04-17T00:00:00.000Z"`
- WHEN the list row renders
- THEN the date cell shows `"17/04/2026"`
- AND it is NOT `"16/04/2026"`

#### Scenario: Sale list row shows correct date for noon-UTC record (new records after fix)

- GIVEN the sale list fetches a sale with `date = "2026-04-17T12:00:00.000Z"`
- WHEN the list row renders
- THEN the date cell shows `"17/04/2026"`

---

### REQ-B.4 — `sale.repository.ts` normalizes dates to noon UTC on create and update

In `features/sale/sale.repository.ts`, both the `create` path (line 156) and the `update` path (line 190) MUST store dates as `new Date(input.date + "T12:00:00.000Z")` instead of `new Date(input.date)`. This ensures the stored UTC instant is always at noon, eliminating the UTC-midnight-to-local-day rollover for any timezone within UTC-12 to UTC+12.

**Affected locations**: `sale.repository.ts:156` (create), `sale.repository.ts:190` (update).

#### Scenario: Creating a sale stores date at noon UTC

- GIVEN a sale create payload with `date: "2026-04-17"`
- WHEN `SaleRepository.create(input)` is called
- THEN the value written to the database is `2026-04-17T12:00:00.000Z`
- AND it is NOT `2026-04-17T00:00:00.000Z`

#### Scenario: Updating a sale stores date at noon UTC

- GIVEN a sale update payload with `date: "2026-04-17"`
- WHEN `SaleRepository.update(id, input)` is called
- THEN the value written to the database is `2026-04-17T12:00:00.000Z`
- AND it is NOT `2026-04-17T00:00:00.000Z`

#### Scenario: Noon-UTC stored value round-trips correctly through formatDateBO display

- GIVEN `sale.repository.ts` stored `2026-04-17T12:00:00.000Z` for a sale
- WHEN the API serializes the record and `formatDateBO` renders it in the list or form
- THEN the displayed date is `"17/04/2026"`
