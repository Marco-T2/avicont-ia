# Spec: dispatch-date-handling

## Change: `fix-comprobante-date-tz`

---

## Domain: `dispatch-date-handling`

> **Repository scope note**: `features/dispatch/dispatch.repository.ts` passes `date: input.date` (a raw string) directly to Prisma, which coerces it to UTC midnight. The exploration confirmed this path is already handled correctly by `formatDateBO` on the read side (string-parsing ignores the midnight instant). Therefore `dispatch.repository.ts` requires NO code change for this fix. If a future change adds explicit datetime semantics to the dispatch repo, noon-UTC normalization SHOULD be applied at that point.

---

### REQ-C.1 — `dispatch-form.tsx` default date uses `todayLocal()`

In `components/dispatches/dispatch-form.tsx`, the `useState` initializer that sets the default `date` when creating a new dispatch MUST use `todayLocal()` from `lib/date-utils.ts` instead of `new Date().toISOString().split("T")[0]`.

**Affected location**: `dispatch-form.tsx:289-291` (the `else` branch of the `useState` initializer).

#### Scenario: New dispatch form opened at 21:00 Bolivia time defaults to local calendar day

- GIVEN the user opens `dispatch-form` in create mode
- AND the system clock is at 2026-04-17T21:00:00 local Bolivia time (= 2026-04-18T01:00:00Z)
- WHEN the form initializes its `date` state
- THEN the `<input type="date">` value is `"2026-04-17"`
- AND it is NOT `"2026-04-18"`

#### Scenario: New dispatch form opened at 08:00 Bolivia time defaults to correct day

- GIVEN the user opens `dispatch-form` in create mode
- AND the system clock is at 2026-04-17T08:00:00 local Bolivia time
- WHEN the form initializes its `date` state
- THEN the `<input type="date">` value is `"2026-04-17"`

---

### REQ-C.2 — `dispatch-form.tsx` display calls route through `formatDateBO`

All date display expressions in `components/dispatches/dispatch-form.tsx` that currently call `new Date(x).toLocaleDateString("es-BO")` MUST be replaced with `formatDateBO(x)`.

**Affected locations**:
- `dispatch-form.tsx:794` — read-only `Fecha` header when viewing a saved dispatch
- `dispatch-form.tsx:1444` — `payment.date` display inside the cobro allocation summary

#### Scenario: Read-only fecha header shows correct calendar day for UTC-midnight record

- GIVEN a dispatch was saved with `date` stored as `2026-04-17T00:00:00.000Z`
- WHEN the user opens that dispatch in view/edit mode and the form renders the read-only `Fecha` field
- THEN the displayed value is `"17/04/2026"`
- AND it is NOT `"16/04/2026"`

#### Scenario: Dispatch cobro allocation payment.date shows correct calendar day

- GIVEN a dispatch has a payment allocation entry with `payment.date` stored as `2026-04-17T00:00:00.000Z`
- WHEN the cobro allocation summary renders inside `dispatch-form`
- THEN the payment date column shows `"17/04/2026"`
- AND it is NOT `"16/04/2026"`

#### Scenario: Dispatch list row shows correct date for UTC-midnight record

- GIVEN `dispatch-list.tsx` fetches a dispatch with `date = "2026-04-17T00:00:00.000Z"`
- WHEN the list row renders (using `formatDateBO` after the replacement)
- THEN the date cell shows `"17/04/2026"`
- AND it is NOT `"16/04/2026"`
