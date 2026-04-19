# Tasks: fix-comprobante-date-tz — Off-by-one comprobante date (UTC vs UTC-4)

## PR0 — Vitest TZ environment setup

- [x] T0.1 CONFIG (REQ-A.1) — Add `env: { TZ: "America/La_Paz" }` to both `node` and `components` project blocks in `vitest.config.ts`. Verify by running `pnpm vitest run` — the existing suite must stay green. Deps: none.

> **Why this is PR0**: `todayLocal()` uses `new Date().getFullYear/getMonth/getDate` (local-time getters). `vi.setSystemTime()` operates on the JS clock but `getFullYear/getMonth/getDate` read the process TZ. Without `TZ=America/La_Paz` the regression case — 23:00 local showing next day in UTC — cannot be proven or disproven in a reproducible way. Set it globally so all 4 PRs run in the correct timezone context.

---

## PR1 — `lib/date-utils.ts` helpers (REQ-A.1, A.2, A.3)

- [x] T1.1 RED (REQ-A.1) — Create `lib/__tests__/date-utils.test.ts` (node project). Write failing tests for `todayLocal()`:
  - (a) 15:00 BO → `"2026-04-17"` (baseline, no rollover)
  - (b) **regression case**: 23:00 BO on Apr 17 = 03:00 UTC Apr 18 → `"2026-04-17"` (NOT `"2026-04-18"`)
  - (c) 00:30 BO on Apr 18 → `"2026-04-18"` (confirms new day is correct)
  - (d) Dec 31 23:59 BO → year does NOT roll to next year
  - Use `vi.useFakeTimers()` + `vi.setSystemTime(new Date("2026-04-18T03:00:00.000Z"))` for case (b). Import from `@/lib/date-utils` (file does not exist yet). Deps: T0.1.
- [x] T1.2 RED (REQ-A.2, A.3) — In same test file, write failing tests for `formatDateBO()`:
  - (a) `"2026-04-17"` → `"17/04/2026"`
  - (b) `"2026-04-17T00:00:00.000Z"` (legacy UTC-midnight) → `"17/04/2026"`
  - (c) `"2026-04-17T12:00:00.000Z"` (new UTC-noon) → `"17/04/2026"`
  - (d) `new Date("2026-04-17T12:00:00.000Z")` (Date instance) → `"17/04/2026"`
  - (e) `"2026-01-05"` → `"05/01/2026"` (zero-padding both day and month)
  - (f) `null` → `""`; `undefined` → `""`; `""` → `""`; `"abc"` (< 10 chars) → `""`; `"not-a-date"` → `""`; `new Date("invalid")` → `""` (NaN Date)
  - Deps: T0.1.
- [x] T1.3 RED (REQ-A.3) — In same test file, write failing tests for `toNoonUtc()`:
  - (a) `"2026-04-17"` → `new Date("2026-04-17T12:00:00.000Z")`
  - (b) full ISO input `"2026-04-17T00:00:00.000Z"` → same result `new Date("2026-04-17T12:00:00.000Z")` (must `slice(0,10)` internally — no double-append)
  - (c) full ISO with non-midnight `"2026-04-17T08:30:00.000Z"` → `new Date("2026-04-17T12:00:00.000Z")`
  - (d) `""` → throws `RangeError`
  - (e) `"abcd"` → throws `RangeError`
  - Deps: T0.1.
- [x] T1.4 GREEN (REQ-A.1, A.2, A.3) — Create `lib/date-utils.ts` implementing all three exports. JSDoc on each function MUST call out the TZ trap for `todayLocal`, the "never instantiates a Date for format step" guarantee for `formatDateBO`, and the "always slice(0,10)" rule for `toNoonUtc`. AC: T1.1 + T1.2 + T1.3 all green + `tsc --noEmit` clean. Deps: T1.1, T1.2, T1.3.

---

## PR2 — Server repos noon-UTC normalization (REQ-B.4, D.3, E.1 + R.1 revisions)

> **Gotcha**: `new Date("YYYY-MM-DD")` is parsed as UTC midnight per ECMAScript spec. Naively appending `+ "T12:00:00.000Z"` to an existing full ISO string would produce `"2026-04-17T00:00:00.000ZT12:00:00.000Z"`. `toNoonUtc` avoids this by internally calling `slice(0,10)` before appending. The RED test in T1.3b covers this. All repo changes go through `toNoonUtc`.

### sale.repository.ts (REQ-B.4)

- [x] T2.1 RED (REQ-B.4) — Create `features/sale/__tests__/sale-repo-noon-utc.test.ts` (node project, Prisma mocked). Write two failing tests:
  - (a) `createSale` called with `date: "2026-04-17"` → `prisma.sale.create` receives `date: new Date("2026-04-17T12:00:00.000Z")`
  - (b) `updateSale` called with `date: "2026-04-17"` → `prisma.sale.update` receives `date: new Date("2026-04-17T12:00:00.000Z")`
  - Mock `@/lib/db` (prisma client). Deps: T1.4.
- [x] T2.2 GREEN (REQ-B.4) — In `features/sale/sale.repository.ts` at lines 156 (create) and 190 (update): replace `date: new Date(input.date)` with `date: toNoonUtc(input.date)`. Import `toNoonUtc` from `@/lib/date-utils`. AC: T2.1 green. Deps: T2.1.

### purchase.repository.ts (REQ-D.3)

- [x] T2.3 RED (REQ-D.3) — Create `features/purchase/__tests__/purchase-repo-noon-utc.test.ts`. Same pattern:
  - (a) `createPurchase` with `date: "2026-04-17"` → `prisma.purchase.create` receives `date: new Date("2026-04-17T12:00:00.000Z")`
  - (b) `updatePurchase` with `date: "2026-04-17"` → same
  - Deps: T1.4.
- [x] T2.4 GREEN (REQ-D.3) — In `features/purchase/purchase.repository.ts` at lines 186 (create) and 249 (update): replace `date: new Date(input.date)` with `date: toNoonUtc(input.date)`. Import `toNoonUtc`. AC: T2.3 green. Deps: T2.3.

### iva-books.repository.ts (REQ-E.1)

- [x] T2.5 RED (REQ-E.1) — Create `features/accounting/iva-books/__tests__/iva-books-repo-noon-utc.test.ts`. Four failing assertions (one per write site):
  - (a) `createPurchaseBook` with `fechaFactura: "2026-04-17"` → `prisma.ivaPurchaseBook.create` receives `fechaFactura: new Date("2026-04-17T12:00:00.000Z")`
  - (b) `updatePurchaseBook` with `fechaFactura: "2026-04-17"` → same
  - (c) `createSaleBook` with `fechaFactura: "2026-04-17"` → `prisma.ivaSalesBook.create` receives `fechaFactura: new Date("2026-04-17T12:00:00.000Z")`
  - (d) `updateSaleBook` with `fechaFactura: "2026-04-17"` → same
  - Deps: T1.4.
- [x] T2.6 GREEN (REQ-E.1) — In `features/accounting/iva-books/iva-books.repository.ts` at lines 189, 258, 317, 378: replace each `fechaFactura: new Date(input.fechaFactura)` (or equivalent) with `fechaFactura: toNoonUtc(input.fechaFactura)`. Import `toNoonUtc`. AC: T2.5 green. Deps: T2.5.

### dispatch.repository.ts (REQ-E.1 / R.1)

- [x] T2.7 RED (REQ-E.1) — Create `features/dispatch/__tests__/dispatch-repo-noon-utc.test.ts`. Failing assertions:
  - (a) `createDispatch` with `date: "2026-04-17"` → `prisma.dispatch.create` receives `date: new Date("2026-04-17T12:00:00.000Z")`
  - (b) `updateDispatch` with `date: "2026-04-17"` → same (check if update path exists; if no separate update path, cover only create)
  - Deps: T1.4.
- [x] T2.8 GREEN (REQ-E.1) — In `features/dispatch/dispatch.repository.ts` at line 148 (and update path if present): replace `date: input.date` pass-through with `date: toNoonUtc(input.date)`. Import `toNoonUtc`. AC: T2.7 green + full suite still passing. Deps: T2.7.

---

## PR3 — Form defaults via `todayLocal()` (REQ-B.1, C.1, D.1)

### sale-form.tsx (REQ-B.1)

- [x] T3.1 RED (REQ-B.1) — Create `components/sales/__tests__/sale-form-today-default.test.tsx` (jsdom/components project). Mock system time to 23:00 BO on Apr 17 = `vi.setSystemTime(new Date("2026-04-18T03:00:00.000Z"))`. Mount `<SaleForm mode="new" ... />` with no `sale` prop. Assert that the date `<input>` value is `"2026-04-17"` (NOT `"2026-04-18"`). Deps: T1.4.
- [x] T3.2 GREEN (REQ-B.1) — In `components/sales/sale-form.tsx` line 156 (new-record branch only): replace `: new Date().toISOString().split("T")[0]` with `: todayLocal()`. Import `todayLocal` from `@/lib/date-utils`. The edit-reuse branch `new Date(sale.date).toISOString().split("T")[0]` stays UNCHANGED (safe per design D.5). AC: T3.1 green. Deps: T3.1.

### dispatch-form.tsx (REQ-C.1)

- [x] T3.3 RED (REQ-C.1) — Create `components/dispatches/__tests__/dispatch-form-today-default.test.tsx`. Same fake-timer pattern: 23:00 BO, mount `<DispatchForm mode="new" ... />`, assert date input = `"2026-04-17"`. Deps: T1.4.
- [x] T3.4 GREEN (REQ-C.1) — In `components/dispatches/dispatch-form.tsx` line 291: replace `: new Date().toISOString().split("T")[0]` with `: todayLocal()`. AC: T3.3 green. Deps: T3.3.

### purchase-form.tsx (REQ-D.1)

- [x] T3.5 RED (REQ-D.1) — Create `components/purchases/__tests__/purchase-form-today-default.test.tsx`. Same fake-timer pattern: 23:00 BO, mount `<PurchaseForm mode="new" ... />`, assert (a) main date input = `"2026-04-17"`, (b) if FLETE detail is rendered, its `fecha` input also = `"2026-04-17"`. Deps: T1.4.
- [x] T3.6 GREEN (REQ-D.1) — In `components/purchases/purchase-form.tsx`: replace `: new Date().toISOString().split("T")[0]` with `: todayLocal()` at line 215 (main date) and line 241 (FLETE fecha re-fill). AC: T3.5 green. Deps: T3.5.

---

## PR4 — Display layer via `formatDateBO()` (REQ-B.2, B.3, C.2, D.2)

> **Visual shift notice**: List views currently output `"17 abr 2026"` (short-month format via `{ day: "2-digit", month: "short", year: "numeric" }`). After this PR they output `"17/04/2026"` (DD/MM/YYYY zero-padded). This is an ACCEPTED visual change (design D.2). Flag in PR description.
>
> **Existing tests to migrate BEFORE swapping code** (these assert old formats):
> - Any test in `components/dispatches/__tests__/dispatch-list.test.tsx` asserting a short-month date string
> - Any test in `components/purchases/__tests__/purchase-list-unification.test.tsx` asserting a date format
> - Search for `"abr"`, `"mar"`, `"ene"`, `/\d+ \w+ 20\d\d/` patterns in the jsdom test suite before starting this PR
>
> **grep before coding**: run `grep -r "toLocaleDateString\|abr 20\|ene 20\|feb 20" components/ --include="*.test.tsx"` to enumerate all tests needing migration. Include that list in the PR description.

- [x] T4.1 RED (REQ-B.3) — In `components/sales/__tests__/sale-list-date-format.test.tsx` (new file): render `<SaleList>` with a sale fixture where `date = "2026-04-17T00:00:00.000Z"`. Assert the rendered date cell contains `"17/04/2026"`. The test is RED because `sale-list.tsx:56` still uses the old `formatDate` local helper calling `toLocaleDateString`. Deps: T1.4.
- [x] T4.2 RED (REQ-B.2) — In `components/sales/__tests__/sale-form-display-date.test.tsx` (new file): render `<SaleForm mode="view" sale={...} />` with `sale.date = "2026-04-17T00:00:00.000Z"`. Assert (a) the read-only Fecha field at line 545 renders `"17/04/2026"`, (b) a cobro allocation with `payment.date = "2026-04-17T00:00:00.000Z"` renders `"17/04/2026"` (line 888). Deps: T1.4.
- [x] T4.3 RED (REQ-C.2) — In `components/dispatches/__tests__/dispatch-list-date-format.test.tsx` (new file) OR extend `dispatch-list.test.tsx`: assert dispatch list date cell = `"17/04/2026"`. If `dispatch-list.test.tsx` has existing assertions for the old locale format, migrate them in this task (make them RED first by changing the expected value, before touching production code). Deps: T1.4.
- [x] T4.4 RED (REQ-C.2) — In `components/dispatches/__tests__/dispatch-form-display-date.test.tsx` (new file): render `<DispatchForm mode="view" dispatch={...} />` with dates at UTC-midnight. Assert (a) line 794 read-only Fecha = `"17/04/2026"`, (b) cobro payment.date at line 1444 = `"17/04/2026"`. Deps: T1.4.
- [x] T4.5 RED (REQ-D.2) — In `components/purchases/__tests__/purchase-form-display-date.test.tsx` (new file): render `<PurchaseForm mode="view" purchase={...} />`. Assert (a) line 683 read-only Fecha = `"17/04/2026"`, (b) pago payment.date at line 1464 = `"17/04/2026"`. Deps: T1.4.
- [x] T4.6 RED (REQ-D.2) — In `components/purchases/__tests__/purchase-list-date-format.test.tsx` (new file) OR extend `purchase-list-unification.test.tsx`: assert purchase list date cell = `"17/04/2026"`. Migrate any existing tests asserting old locale format. Deps: T1.4.
- [x] T4.7 GREEN (REQ-B.3) — In `components/sales/sale-list.tsx`: replace the local `formatDate` function at line 55–61 entirely with `formatDateBO` imported from `@/lib/date-utils`. Update call sites in the same file. AC: T4.1 green. Deps: T4.1, T4.2.
- [x] T4.8 GREEN (REQ-B.2) — In `components/sales/sale-form.tsx`: replace `new Date(sale!.date).toLocaleDateString("es-BO")` at line 545 and `new Date(alloc.payment.date).toLocaleDateString("es-BO")` at line 888 with `formatDateBO(sale!.date)` and `formatDateBO(alloc.payment.date)`. Import `formatDateBO` from `@/lib/date-utils`. AC: T4.2 green. Deps: T4.2.
- [x] T4.9 GREEN (REQ-C.2) — In `components/dispatches/dispatch-list.tsx`: replace `toLocaleDateString` call at line 51 with `formatDateBO(...)`. Import `formatDateBO`. In `components/dispatches/dispatch-form.tsx`: replace calls at lines 794 and 1444. AC: T4.3 + T4.4 green. Deps: T4.3, T4.4.
- [x] T4.10 GREEN (REQ-D.2) — In `components/purchases/purchase-form.tsx`: replace `toLocaleDateString` calls at lines 683 and 1464 with `formatDateBO(...)`. In `components/purchases/purchase-list.tsx`: replace call at line 59. Import `formatDateBO`. AC: T4.5 + T4.6 green. Deps: T4.5, T4.6.
- [x] T4.11 SWEEP (REQ-B.2, C.2, D.2) — `grep -r "toLocaleDateString" components/ --include="*.tsx"` — no remaining comprobante-date sites in sales/dispatches/purchases. Accounting lists deferred per design D.5 REVISION. AC: `tsc --noEmit` clean + 884/884 tests green. Deps: T4.7, T4.8, T4.9, T4.10.

---

## Coverage Matrix

| REQ | RED Task(s) | Covered? |
|-----|-------------|----------|
| REQ-A.1 | T1.1, T3.1, T3.3, T3.5 | ✅ |
| REQ-A.2 | T1.2 | ✅ |
| REQ-A.3 | T1.2 (edge cases), T1.3 | ✅ |
| REQ-B.1 | T3.1 | ✅ |
| REQ-B.2 | T4.2 | ✅ |
| REQ-B.3 | T4.1 | ✅ |
| REQ-B.4 | T2.1 | ✅ |
| REQ-C.1 | T3.3 | ✅ |
| REQ-C.2 | T4.3, T4.4 | ✅ |
| REQ-D.1 | T3.5 | ✅ |
| REQ-D.2 | T4.5, T4.6 | ✅ |
| REQ-D.3 | T2.3 | ✅ |
| REQ-E.1 | T2.5, T2.7 | ✅ |

All 13 requirements (REQ-A.1 through REQ-E.1) have at least one RED task. **Coverage complete — no gaps.**

---

## Task count summary

| Phase | Tasks | Notes |
|-------|-------|-------|
| PR0 (TZ config) | 1 | Prerequisite for all |
| PR1 (date-utils) | 4 | 3 RED + 1 GREEN |
| PR2 (repos noon-UTC) | 8 | 4 RED + 4 GREEN (one pair per repo) |
| PR3 (form defaults) | 6 | 3 RED + 3 GREEN |
| PR4 (display layer) | 11 | 6 RED + 4 GREEN + 1 sweep |
| **Total** | **30** | |

---

## Fix Batch (post-verify) — C-1, W-1, W-2

Issues found by sdd-verify after PR0–PR4. Fixed 2026-04-17.

### C-1 — Remaining `new Date().toISOString().split("T")[0]` refs (CRITICAL)

- [x] FC-1.1 RED+GREEN — `components/payments/payment-form.tsx:206` → `todayLocal()`
- [x] FC-1.2 RED+GREEN — `components/lots/create-lot-dialog.tsx` (3 refs: lines 35, 74, 95) → `todayLocal()`
- [x] FC-1.3 RED+GREEN — `components/expenses/create-expense-form.tsx` (3 refs: lines 53, 87, 108) → `todayLocal()`
- [x] FC-1.4 RED+GREEN — `components/mortality/log-mortality-form.tsx` (3 refs: lines 35, 68, 88) → `todayLocal()`

Tests added: `payment-form-today-default.test.tsx`, `create-lot-dialog-today-default.test.tsx`, `create-expense-form-today-default.test.tsx`, `log-mortality-form-today-default.test.tsx`

Commits: `92fdeee`

### W-1 — `emptyFleteeLine()` fecha default (WARNING)

- [x] FW-1.1 RED+GREEN — `components/purchases/purchase-form.tsx:161` `emptyFleteeLine()` → `fecha: todayLocal()`

Tests added: `purchase-form-flete-line-today-default.test.tsx`

Commit: `4cc4869`

### W-2 — Journal entry forms (WARNING)

- [x] FW-2.1 RED+GREEN — `components/accounting/journal-entry-form.tsx:82` → `todayLocal()`
- [x] FW-2.2 RED+GREEN — `components/accounting/create-journal-entry-form.tsx:60` → `todayLocal()`

Tests added: `journal-entry-form-today-default.test.tsx`

Commit: `cfffd76`

### Result

- Tests: 899/899 (was 884/884 before fix batch)
- TSC: clean
- `new Date().toISOString().split("T")[0]` in `components/` outside tests: **0 hits**
