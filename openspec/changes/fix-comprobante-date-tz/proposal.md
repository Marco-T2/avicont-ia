# Proposal: Fix off-by-one date on sale/dispatch/purchase comprobantes (UTC vs UTC-4)

## Intent

A user reported that a sale registered locally on **2026-04-17** was saved/displayed as **2026-04-16** — the classic UTC-vs-local off-by-one-day bug for a country permanently at **UTC-4** (Bolivia). The codebase is mixing two incompatible date representations: (a) a local `"YYYY-MM-DD"` string typed by the user in an `<input type="date">`, and (b) a `Date` object produced by `new Date(isoString)` whose `.toLocaleDateString("es-BO")` converts a stored UTC-midnight instant to the previous local calendar day. The exploration traced every call site across sales, dispatches, purchases, payments and IVA books, and the root cause is split across **three code paths**: (1) form default "today" using `new Date().toISOString().split("T")[0]`, (2) display layer using `new Date(x).toLocaleDateString("es-BO")` on UTC-midnight values, and (3) server repositories writing `new Date(input.date)` which PostgreSQL stores as UTC midnight. This change ports all three paths to a consistent string-first convention via two shared utilities and a noon-UTC normalization on the server, with **no data migration** required — old UTC-midnight rows render correctly through the new string-parsing helper.

## Scope

### In Scope

- **S.1** Create `lib/date-utils.ts` exporting two pure helpers:
  - `todayLocal(): string` — returns today's date as `"YYYY-MM-DD"` using local-time getters (`getFullYear` / `getMonth` / `getDate`) instead of `toISOString()`.
  - `formatDateBO(value: string | Date): string` — returns `"DD/MM/YYYY"` by string-parsing the ISO date portion directly, never instantiating a `Date` for the format step (so there is no TZ conversion).
- **S.2** Replace every `new Date().toISOString().split("T")[0]` form-default with `todayLocal()` in all affected forms (sale, dispatch, purchase, payment, create-lot, create-expense, log-mortality, and any FLETE detail `fecha` re-fill).
- **S.3** Replace every display-layer `new Date(x).toLocaleDateString("es-BO")` with `formatDateBO(x)` across all list views and read-only form headers (sale, dispatch, purchase forms + `sale-list`, `dispatch-list`, `purchase-list`, plus payment-allocation sub-rows inside each form).
- **S.4** In server repositories (`features/sale/sale.repository.ts:156,190`, `features/purchase/purchase.repository.ts:186,249`), change `new Date(input.date)` to `new Date(input.date + "T12:00:00.000Z")` so new records are stored at UTC noon — unambiguous for any timezone within UTC-12 to UTC+12.
- **S.5** NO data migration. Existing records stored at UTC midnight render correctly because `formatDateBO` parses the ISO string's first 10 chars (`"YYYY-MM-DD"`) directly without instantiating a `Date`, so the calendar day is preserved regardless of whether the instant was midnight or noon UTC.

### Out of Scope

- `saleFiltersSchema` `z.coerce.date()` fix in `features/sale/sale.validation.ts:36` — same class of bug but affects filter range queries only; **deferred to a separate ticket**.
- Any change to locale or the output format beyond what `formatDateBO` produces (`"DD/MM/YYYY"`).
- Any change to the Prisma schema — no column type change, no migration.
- Any change to `IvaBookPurchaseModal` / `IvaBookSaleModal` internal date handling — the modal pre-fill path (`new Date(x).toISOString().split("T")[0]`) is already safe per the exploration.
- The dispatch repository's `date: input.date` path (pass-through string to Prisma) — reviewed in exploration; Prisma coerces the bare string to UTC midnight, which is already handled correctly by the new display helper, so this line is left alone to avoid unrelated churn.

## Capabilities

### New Capabilities

- `shared-date-utils` — a brand-new domain: `lib/date-utils.ts` exporting `todayLocal()` and `formatDateBO(value)`. First centralized date utility in the codebase.

### Modified Capabilities

- `sale-date-handling` — sale-form default-today, read-only header display, sale-list rows, and sale repository `create` / `update` server paths all route through the new utilities + noon-UTC normalization.
- `dispatch-date-handling` — dispatch-form default-today, read-only header display, dispatch-list rows, and payment-allocation sub-rows route through the new display helper.
- `purchase-date-handling` — purchase-form default-today (including FLETE detail `fecha` re-fill), read-only header display, purchase-list rows, payment-allocation sub-rows, and purchase repository `create` / `update` server paths route through the new utilities + noon-UTC normalization.
- `iva-book-date-handling` — no code change required in this pass (`iva-books.repository.ts:64,130` already does `toISOString().slice(0,10)` which is safe for UTC-midnight rows); capability is listed as *modified* only because future reads/writes MUST consume `formatDateBO` at any new display touchpoint.

## Approach

Reference for the shape of the utilities is in the exploration (§ Recommendation). The four concrete pieces:

1. **Create the shared utility** — `lib/date-utils.ts` with `todayLocal()` and `formatDateBO(value: string | Date)`. Pure functions, zero deps, trivial to unit-test. Both helpers avoid the two failure modes:
   - `todayLocal()` uses `getFullYear` / `getMonth` / `getDate` — local-time getters — instead of `toISOString()`, so the "today" of a user in Bolivia at 21:00 local is `"2026-04-17"`, not `"2026-04-18"`.
   - `formatDateBO(value)` takes either a string or a `Date`, slices the first 10 chars of the ISO form, and formats `DD/MM/YYYY` without ever going through `Date.prototype.toLocaleDateString`. This is what makes the fix retroactive for existing rows.

2. **Replace form defaults** — every call site matching `new Date().toISOString().split("T")[0]` becomes `todayLocal()`. Exploration enumerated the call sites:
   - `components/sales/sale-form.tsx:155-156`
   - `components/dispatches/dispatch-form.tsx:289-291`
   - `components/purchases/purchase-form.tsx:213-215` (plus `purchase-form.tsx:241` for FLETE detail `fecha`)
   - `components/payments/payment-form.tsx`
   - `components/lots/create-lot-dialog.tsx`
   - `components/expenses/create-expense-form.tsx`
   - `components/mortality/log-mortality-form.tsx`
   - The edit-mode re-fill (`new Date(sale.date).toISOString().split("T")[0]`) also routes to `formatDateBO`-style parsing via a small helper internally if needed, but the exploration notes it is safe as-is for `<input type="date">` values, so we keep it alone.

3. **Replace display calls** — every `new Date(x).toLocaleDateString("es-BO")` in a display context becomes `formatDateBO(x)`. Exploration enumerated the guilty lines:
   - `components/sales/sale-form.tsx:545` (read-only fecha)
   - `components/sales/sale-form.tsx:888` (cobro allocation payment.date)
   - `components/sales/sale-list.tsx:56`
   - `components/dispatches/dispatch-form.tsx:794` (read-only fecha)
   - `components/dispatches/dispatch-form.tsx:1444` (cobro allocation payment.date)
   - `components/dispatches/dispatch-list.tsx` (list row)
   - `components/purchases/purchase-form.tsx:683` (read-only fecha)
   - `components/purchases/purchase-form.tsx:1464` (pago allocation payment.date)
   - `components/purchases/purchase-list.tsx` (list row)

4. **Server noon-UTC normalization** — in `features/sale/sale.repository.ts:156,190` and `features/purchase/purchase.repository.ts:186,249`, change:
   ```ts
   date: new Date(input.date)
   ```
   to:
   ```ts
   date: new Date(input.date + "T12:00:00.000Z")
   ```
   This is the minimal server delta. It is forward-compatible with the display helper (noon-UTC parsed back through `formatDateBO` yields the correct calendar day) and back-compatible with existing UTC-midnight rows (they also parse correctly through `formatDateBO`). No migration is triggered.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `lib/date-utils.ts` | **New** | `todayLocal()` + `formatDateBO(value)` shared helpers |
| `components/sales/sale-form.tsx` | Modified | default-today, read-only fecha display, cobro allocation display |
| `components/sales/sale-list.tsx` | Modified | list row date format |
| `components/dispatches/dispatch-form.tsx` | Modified | default-today, read-only fecha, cobro allocation display |
| `components/dispatches/dispatch-list.tsx` | Modified | list row date format |
| `components/purchases/purchase-form.tsx` | Modified | default-today, FLETE detail `fecha`, read-only fecha, pago allocation display |
| `components/purchases/purchase-list.tsx` | Modified | list row date format |
| `components/payments/payment-form.tsx` | Modified | default-today |
| `components/lots/create-lot-dialog.tsx` | Modified | default-today |
| `components/expenses/create-expense-form.tsx` | Modified | default-today |
| `components/mortality/log-mortality-form.tsx` | Modified | default-today |
| `features/sale/sale.repository.ts` | Modified | `create`/`update` date write normalized to noon UTC |
| `features/purchase/purchase.repository.ts` | Modified | `create`/`update` date write normalized to noon UTC |
| `features/dispatch/dispatch.repository.ts` | **None** | Pass-through string to Prisma, display helper covers the read path |
| `features/accounting/iva-books/iva-books.repository.ts` | **None** | `toISOString().slice(0,10)` is safe for UTC-midnight rows |
| `prisma/schema.prisma` | **None** | No column change, no migration |
| `lib/__tests__/date-utils.test.ts` | **New** | Unit tests for `todayLocal()` and `formatDateBO()` against UTC-midnight and noon-UTC inputs |

## Non-Goals

- `saleFiltersSchema` `z.coerce.date()` — deferred to a separate ticket.
- Locale or output-format changes beyond `formatDateBO` returning `"DD/MM/YYYY"`.
- Prisma schema or column-type changes.
- Data migration of existing `sales.date`, `dispatches.date`, `purchases.date`, `payments.date`, `iva_purchase_books.fechaFactura`, `iva_sales_books.fechaFactura` rows.
- Multi-timezone support — app remains single-tenant Bolivia (UTC-4); `todayLocal()` relies on the machine's local TZ (browser for client, server `TZ` env for the server).
- Any UI copy change on the forms.

## Open Questions

None. User has confirmed Approach 1 from the exploration, the utility signatures (`todayLocal()` + `formatDateBO()`), the noon-UTC server strategy, the no-migration stance, and the `"DD/MM/YYYY"` output format for `formatDateBO`.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Existing tests asserting exact date strings (`"2025-03-15"` or `"15/3/2025"`) break when routed through `formatDateBO` | Med | Update the affected unit tests in the same commit; `formatDateBO` output is deterministic (`"DD/MM/YYYY"` with zero-padding) so test migration is mechanical |
| Server `TZ` env var is not set to UTC on production — `todayLocal()` running on a server-side render would return the server's local day, not Bolivia's | Low | All forms in the affected set are `"use client"` already; `todayLocal()` only runs in the browser. Add an explicit note to the utility JSDoc that it is intended for client use. |
| A future developer adds a new date-field form and reaches for `new Date().toISOString()` again | Med | Add a short JSDoc + inline comment to the utility file, and rely on the test suite + code review to catch it |
| `saleFiltersSchema` date filter window remains off-by-one | Low | Explicitly deferred per user scope; document in follow-up ticket |
| Noon-UTC normalization on server clashes with a Prisma column constraint that expects midnight | Very Low | `DateTime` in PostgreSQL via Prisma stores any instant; no constraint exists in the schema |

## Rollback Plan

Pure additive + swap. Rollback strategy:

1. Revert the commits that replace `new Date().toISOString()` and `toLocaleDateString` call sites — all affected files restore their prior behavior verbatim.
2. Revert the two `.repository.ts` one-line changes — server writes revert to `new Date(input.date)` (UTC midnight).
3. Delete `lib/date-utils.ts` + its test file.

No DB migration ran, so there is no data transform to reverse. Records written during the window between merge and rollback will be at UTC noon instead of UTC midnight — both still parse correctly through either the old `toLocaleDateString` display (which would shift noon UTC back by 4 hours, still the same calendar day) or the new `formatDateBO`. No user-visible regression on rollback.

## Dependencies

- None external. Pure TypeScript + existing Prisma/Postgres stack. No new npm packages.

## Success Criteria

- [ ] A sale created at 21:00 local time on 2026-04-17 persists and displays as **17/04/2026** in the form header, the sale list, the cobro allocation summary, and the IVA modal.
- [ ] Opening a new `sale-form` / `dispatch-form` / `purchase-form` at any local time between 20:00 and 03:59 yields the correct local calendar day as the default `<input type="date">` value.
- [ ] Old sales/dispatches/purchases created before this change (stored at UTC midnight) continue to display the correct calendar day via `formatDateBO`.
- [ ] `lib/date-utils.ts` has 100% unit-test coverage on both exported functions, including edge cases: 20:00 local time default, midnight-UTC input, noon-UTC input.
- [ ] Zero references to `new Date().toISOString().split("T")[0]` remain in `components/**/*.tsx` outside of tests.
- [ ] Zero references to `new Date(x).toLocaleDateString("es-BO")` remain in display contexts inside `components/sales/**`, `components/dispatches/**`, `components/purchases/**`.
- [ ] `features/sale/sale.repository.ts` and `features/purchase/purchase.repository.ts` write dates as `new Date(input.date + "T12:00:00.000Z")` in both `create` and `update` paths.
