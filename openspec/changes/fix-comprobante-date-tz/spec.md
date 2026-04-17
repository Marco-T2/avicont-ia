# Spec: Fix off-by-one date on sale/dispatch/purchase comprobantes (UTC vs UTC-4)

## Change: `fix-comprobante-date-tz`

---

## Overview

This change fixes a classic UTC-vs-local off-by-one-day bug affecting Bolivia (UTC-4). The root cause is split across three code paths: (1) form default "today" using `new Date().toISOString().split("T")[0]`, (2) display layer using `new Date(x).toLocaleDateString("es-BO")` on UTC-midnight-stored values, and (3) server repositories writing `new Date(input.date)` which PostgreSQL stores as UTC midnight. The fix introduces two shared pure helpers in `lib/date-utils.ts`, replaces all guilty call sites, and normalizes new DB writes to noon UTC. No data migration is required.

**Domains**: 5  
**Requirements**: 13 (REQ-A.1 through REQ-E.1)  
**Scenarios**: 32

---

## Domain: `shared-date-utils` — NEW

See full domain spec: `specs/shared-date-utils/spec.md`

### REQ-A.1 — `todayLocal()` returns current local calendar day as `"YYYY-MM-DD"`

`lib/date-utils.ts` MUST export `todayLocal(): string` using local-time getters (`getFullYear`, `getMonth`, `getDate`) — NOT `toISOString()`. Client-only intent must be documented in JSDoc.

**Key scenario**: Given user is at 21:00 local time on 2026-04-17 BO, When form defaults date, Then value is `"2026-04-17"` (not `"2026-04-18"`).

---

### REQ-A.2 — `formatDateBO(value)` returns `"DD/MM/YYYY"` via string parsing only

`lib/date-utils.ts` MUST export `formatDateBO(value: string | Date): string` that slices the ISO `"YYYY-MM-DD"` prefix and formats by splitting on `"-"`. MUST NOT call `toLocaleDateString` at any point.

**Key scenario**: Given stored DB value is `2026-04-17T00:00:00.000Z`, When `formatDateBO` renders, Then output is `"17/04/2026"` (regardless of display timezone).

---

### REQ-A.3 — Edge cases: null/undefined, invalid strings, NaN Date

`formatDateBO` MUST return `""` (empty string) without throwing for: `null`, `undefined`, empty string, strings shorter than 10 chars, non-ISO strings, and `Date` instances with `NaN` time.

---

## Domain: `sale-date-handling`

See full domain spec: `specs/sale-date-handling/spec.md`

### REQ-B.1 — `sale-form.tsx` default date uses `todayLocal()`

Replace `new Date().toISOString().split("T")[0]` at `sale-form.tsx:155-156` with `todayLocal()`.

### REQ-B.2 — `sale-form.tsx` display calls route through `formatDateBO`

Replace `new Date(x).toLocaleDateString("es-BO")` at `sale-form.tsx:545` (read-only Fecha) and `:888` (cobro allocation `payment.date`) with `formatDateBO(x)`.

### REQ-B.3 — `sale-list.tsx` list row date uses `formatDateBO`

Replace `new Date(date).toLocaleDateString("es-BO", {...})` at `sale-list.tsx:56` with `formatDateBO(date)`.

### REQ-B.4 — `sale.repository.ts` normalizes dates to noon UTC

At `sale.repository.ts:156` (create) and `:190` (update), replace `new Date(input.date)` with `new Date(input.date + "T12:00:00.000Z")`.

**Key scenario**: Given payload date `"2026-04-17"`, When sale repo creates, Then stored value is `2026-04-17T12:00:00.000Z`.

---

## Domain: `dispatch-date-handling`

See full domain spec: `specs/dispatch-date-handling/spec.md`

> `features/dispatch/dispatch.repository.ts` requires NO change — pass-through string to Prisma; read side covered by `formatDateBO`.

### REQ-C.1 — `dispatch-form.tsx` default date uses `todayLocal()`

Replace `new Date().toISOString().split("T")[0]` at `dispatch-form.tsx:289-291` with `todayLocal()`.

### REQ-C.2 — `dispatch-form.tsx` display calls route through `formatDateBO`

Replace `new Date(x).toLocaleDateString("es-BO")` at `dispatch-form.tsx:794` (read-only Fecha) and `:1444` (cobro allocation `payment.date`) with `formatDateBO(x)`. Also replace the equivalent expression in `dispatch-list.tsx` list rows.

---

## Domain: `purchase-date-handling`

See full domain spec: `specs/purchase-date-handling/spec.md`

### REQ-D.1 — `purchase-form.tsx` default date uses `todayLocal()`

Replace `new Date().toISOString().split("T")[0]` at `purchase-form.tsx:213-215` (main date) and `:241` (FLETE detail `fecha` re-fill) with `todayLocal()`.

### REQ-D.2 — `purchase-form.tsx` display calls route through `formatDateBO`

Replace `new Date(x).toLocaleDateString("es-BO")` at `purchase-form.tsx:683` (read-only Fecha) and `:1464` (pago allocation `payment.date`) with `formatDateBO(x)`. Also replace the equivalent expression in `purchase-list.tsx` list rows.

### REQ-D.3 — `purchase.repository.ts` normalizes dates to noon UTC

At `purchase.repository.ts:186` (create) and `:249` (update), replace `new Date(input.date)` with `new Date(input.date + "T12:00:00.000Z")`.

---

## Domain: `iva-book-date-handling`

See full domain spec: `specs/iva-book-date-handling/spec.md`

### REQ-E.1 — `iva-books.repository.ts` stores `fechaFactura` at noon UTC (4 write sites)

At lines 189, 258, 317, 378, replace `new Date(input.fechaFactura)` with `new Date(input.fechaFactura + "T12:00:00.000Z")` (extracting `"YYYY-MM-DD"` prefix first if the input is a full ISO string). Read paths at lines 64 and 130 use `toISOString().slice(0, 10)` and are safe — NO change required there.

---

## Additional call sites in scope (form defaults only — S.2)

The following components also initialize a `date` field with `new Date().toISOString().split("T")[0]` and MUST be updated to `todayLocal()`. They have no list-display or repository changes:

| File | Purpose |
|------|---------|
| `components/payments/payment-form.tsx` | Payment default date |
| `components/lots/create-lot-dialog.tsx` | Lot creation default date |
| `components/expenses/create-expense-form.tsx` | Expense default date |
| `components/mortality/log-mortality-form.tsx` | Mortality log default date |

---

## Out of Scope

- `features/sale/sale.validation.ts:36` `saleFiltersSchema z.coerce.date()` — deferred to a separate ticket
- `IvaBookPurchaseModal` / `IvaBookSaleModal` pre-fill paths — already safe per exploration
- Prisma schema changes or data migration
- Multi-timezone support
- Any UI copy changes

---

## Files Introduced

| File | Type | Purpose |
|------|------|---------|
| `lib/date-utils.ts` | New | `todayLocal()` + `formatDateBO(value)` |
| `lib/__tests__/date-utils.test.ts` | New | Unit tests — 100% coverage on both helpers |

## Files Modified

| File | Change |
|------|--------|
| `components/sales/sale-form.tsx` | REQ-B.1, REQ-B.2 |
| `components/sales/sale-list.tsx` | REQ-B.3 |
| `components/dispatches/dispatch-form.tsx` | REQ-C.1, REQ-C.2 |
| `components/dispatches/dispatch-list.tsx` | REQ-C.2 |
| `components/purchases/purchase-form.tsx` | REQ-D.1, REQ-D.2 |
| `components/purchases/purchase-list.tsx` | REQ-D.2 |
| `components/payments/payment-form.tsx` | Default date |
| `components/lots/create-lot-dialog.tsx` | Default date |
| `components/expenses/create-expense-form.tsx` | Default date |
| `components/mortality/log-mortality-form.tsx` | Default date |
| `features/sale/sale.repository.ts` | REQ-B.4 |
| `features/purchase/purchase.repository.ts` | REQ-D.3 |
| `features/accounting/iva-books/iva-books.repository.ts` | REQ-E.1 |

## Files Not Modified

| File | Reason |
|------|--------|
| `features/dispatch/dispatch.repository.ts` | Pass-through string; display fix covers read path |
| `prisma/schema.prisma` | No column change, no migration |

---

## Success Criteria

- [ ] Sale created at 21:00 local on 2026-04-17 displays as `17/04/2026` everywhere (form header, list, cobro allocation, IVA modal)
- [ ] Opening any affected form between 20:00–03:59 yields correct local calendar day as default `<input type="date">` value
- [ ] Old UTC-midnight records display correctly via `formatDateBO` — no data migration needed
- [ ] `lib/date-utils.ts` has 100% unit-test coverage on both exported functions
- [ ] Zero `new Date().toISOString().split("T")[0]` references remain in `components/**/*.tsx` outside tests
- [ ] Zero display-context `new Date(x).toLocaleDateString("es-BO")` references remain in `components/sales/**`, `components/dispatches/**`, `components/purchases/**`
- [ ] `sale.repository.ts` and `purchase.repository.ts` write `new Date(input.date + "T12:00:00.000Z")` in both `create` and `update` paths
- [ ] `iva-books.repository.ts` writes `fechaFactura` at noon UTC at all four write sites
