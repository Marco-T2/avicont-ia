# Design: fix-comprobante-date-tz

Technical design for the off-by-one comprobante date bug. Scope, context and call-site inventory live in `proposal.md` and `exploration.md`; this document only commits the **decisions** that drive `sdd-tasks` and `sdd-apply`.

Legend (used throughout):
- **L** — local time as perceived by a user in Bolivia (UTC-4, no DST).
- **UTC-midnight** — an instant stored as `YYYY-MM-DDT00:00:00.000Z`.
- **UTC-noon** — an instant stored as `YYYY-MM-DDT12:00:00.000Z`.

---

## D.1 — API of `lib/date-utils.ts`

**Greenfield**: `lib/date-utils.ts` does NOT exist yet. This is a new file; no existing export to preserve.

Three functions. Two are directly consumed by the proposal (`todayLocal`, `formatDateBO`); the third (`toNoonUtc`) is the server-side normalization helper that the proposal describes inline — we promote it to a named function so the call sites are single-path and unit-testable.

### Signatures

```ts
// lib/date-utils.ts

/**
 * Today's date in local time as a "YYYY-MM-DD" string.
 *
 * Uses getFullYear / getMonth / getDate (local-time getters) instead of
 * toISOString() so a Bolivian user at 21:00 local (01:00 UTC next day) still
 * sees today's local calendar date.
 *
 * Intended for client-side rendering (the browser's local timezone is
 * correct). On the server, this depends on the process TZ — prefer a
 * different helper if a server-side default is ever needed.
 *
 * @returns string formatted as "YYYY-MM-DD" (zero-padded).
 */
export function todayLocal(): string;

/**
 * Format a date-only value for display in es-BO locale as "DD/MM/YYYY".
 *
 * Parses the ISO date portion (first 10 chars) directly without ever
 * instantiating a Date for the format step — this avoids any timezone
 * conversion and makes the output stable for values stored at UTC-midnight
 * (legacy rows) or UTC-noon (new rows).
 *
 * @param value
 *   - string  — "YYYY-MM-DD" or a full ISO "YYYY-MM-DDTHH:mm:ss.sssZ".
 *   - Date    — any Date; the UTC calendar day is used (value.toISOString().slice(0,10)).
 *   - null / undefined — returns "" (defensive, never throws on falsy API payloads).
 * @returns "DD/MM/YYYY" with zero-padded day/month, or "" for null/undefined.
 * @throws  Never. Malformed strings shorter than 10 chars return "" as well.
 */
export function formatDateBO(value: string | Date | null | undefined): string;

/**
 * Normalize a "YYYY-MM-DD" client input to a UTC-noon Date for persistence.
 *
 * Storing the instant at 12:00 UTC guarantees the calendar day round-trips
 * unambiguously for any timezone within UTC-12 .. UTC+12. Use this as the
 * single code path for Sale / Purchase / (and future) repository date
 * writes — do NOT inline `new Date(input.date + "T12:00:00.000Z")`.
 *
 * @param yyyymmdd  a bare "YYYY-MM-DD" string. Anything longer is truncated to 10 chars before appending "T12:00:00.000Z".
 * @returns a Date representing noon UTC on the given calendar day.
 * @throws  RangeError if the resulting Date is Invalid (caller sends trash).
 *          Callers are expected to validate via Zod before calling.
 */
export function toNoonUtc(yyyymmdd: string): Date;
```

### Invalid-input behaviour (explicit)

| Input | `formatDateBO` | `toNoonUtc` |
|-------|----------------|-------------|
| `null` | `""` | **not supported** — never call on null; validate upstream |
| `undefined` | `""` | **not supported** |
| `""` (empty string) | `""` | throws `RangeError("Invalid date: \"\"")` |
| malformed (`"abcd"`) | `""` | throws `RangeError` |
| `Date` (any valid) | day-portion `DD/MM/YYYY` | n/a (not in signature) |
| full ISO (`"2026-04-17T12:00:00.000Z"`) | `"17/04/2026"` | accepts, truncates to first 10 chars then noon-normalizes |
| legacy UTC-midnight Date (`2026-04-17T00:00:00.000Z`) | `"17/04/2026"` (the guarantee that makes the fix retroactive) | n/a |

**Decision: no `formatDateForInput` helper.** The `<input type="date">` value needs `"YYYY-MM-DD"`. The existing `new Date(sale.date).toISOString().split("T")[0]` pattern is safe (exploration § 8) because `.toISOString()` is pure UTC — keep it. If we wanted to collapse that into one helper, we would need a `toIsoDay(value: string | Date): string` — not added in this change to avoid scope creep. Confirmed in D.5 below.

### JSDoc rationale

The proposal § Risks calls out "A future developer adds a new date-field form and reaches for `new Date().toISOString()` again" as a Medium risk mitigated by JSDoc. The comments above must make the WHY explicit:

- `todayLocal` JSDoc MUST mention "local-time getters" and "avoid `toISOString()`".
- `formatDateBO` JSDoc MUST mention "parses the ISO date portion directly without instantiating a Date for the format step".
- `toNoonUtc` JSDoc MUST explain "UTC-noon is unambiguous for any timezone within UTC-12 .. UTC+12".

These three lines are the load-bearing prevention vector. Any future dev reading the file sees the trap.

---

## D.2 — Display format decision

**PROPOSAL CLAIM**: `formatDateBO` returns `"DD/MM/YYYY"`.

**INVESTIGATION** — current outputs by call site:

| Call site | Current call | Current output sample | Matches `DD/MM/YYYY`? |
|-----------|-------------|-----------------------|------------------------|
| `sale-form.tsx:545` | `new Date(sale!.date).toLocaleDateString("es-BO")` | `"17/4/2026"` | **No** — missing zero-pad on month/day |
| `sale-form.tsx:888` | `new Date(alloc.payment.date).toLocaleDateString("es-BO")` | `"17/4/2026"` | **No** — missing zero-pad |
| `sale-list.tsx:56` | `toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" })` | `"17 abr 2026"` | **NO — DIFFERENT FORMAT ENTIRELY** |
| `dispatch-list.tsx:51` | same options object as sale-list | `"17 abr 2026"` | **NO** |
| `purchase-list.tsx:59` | same options object as sale-list | `"17 abr 2026"` | **NO** |
| `dispatch-form.tsx:794` | bare `toLocaleDateString("es-BO")` | `"17/4/2026"` | **No** — missing zero-pad |
| `purchase-form.tsx:684` | bare `toLocaleDateString("es-BO")` | `"17/4/2026"` | **No** — missing zero-pad |

**DECISION**: `formatDateBO` returns **`"DD/MM/YYYY"` with zero-padded day and month**. This is a minor visual shift (`17/04/2026` vs `17/4/2026`) on the bare-form touchpoints — acceptable because zero-padding is the Bolivian SIN convention on facturas.

**List-view touchpoints (`sale-list`, `dispatch-list`, `purchase-list`) are explicitly INCLUDED in the swap and will lose the short-month format** (`"17 abr 2026"` → `"17/04/2026"`). This is a deliberate trade:

- The list views and form headers are the same comprobante display surface; users reading both together expect one convention.
- SIN's official date format on facturas is numeric `DD/MM/YYYY`.
- The short-month format is NOT part of any factura, libro, or report — it was a stylistic choice that now costs consistency.

This is a **known and accepted visual shift**. Flag in PR description. If the product owner objects, the fallback is a second helper `formatDateBOShort(value): "DD MMM YYYY"` — NOT implemented in this change; out of scope.

---

## D.3 — Server repository changes

**Prisma 7.7 + PostgreSQL** — all `date` / `fechaFactura` columns are `DateTime` in the schema, which maps to `TIMESTAMP(3) WITH TIME ZONE` by default (`prisma/schema.prisma:196, 215, 327, 642, 723, 774, 868, 937, 977`). Storage is **full instant**, NOT date-only. This means UTC-noon is stored verbatim as `2026-04-17 12:00:00.000+00`; no rounding. Confirmed.

### Decision: use `toNoonUtc(input.date)` — the helper, not inline

Single code path → testable → one place to change if we ever shift the convention (e.g. future multi-TZ tenancy).

### Call sites — exact lines

| File | Line | Before | After |
|------|------|--------|-------|
| `features/sale/sale.repository.ts` | 156 | `date: new Date(input.date)` | `date: toNoonUtc(input.date)` |
| `features/sale/sale.repository.ts` | 190 | `date: new Date(input.date)` | `date: toNoonUtc(input.date)` |
| `features/sale/sale.repository.ts` | ~220 (update) | `date: new Date(input.date)` if present | `date: toNoonUtc(input.date)` |
| `features/purchase/purchase.repository.ts` | 186 | `date: new Date(input.date)` | `date: toNoonUtc(input.date)` |
| `features/purchase/purchase.repository.ts` | 249 | `date: new Date(input.date)` | `date: toNoonUtc(input.date)` |
| `features/purchase/purchase.repository.ts` | update block | `date: new Date(input.date)` if present | `date: toNoonUtc(input.date)` |
| `features/accounting/iva-books/iva-books.repository.ts` | 189 | `fechaFactura: new Date(input.fechaFactura)` | `fechaFactura: toNoonUtc(input.fechaFactura)` |
| `features/accounting/iva-books/iva-books.repository.ts` | 258 | `fechaFactura: new Date(input.fechaFactura)` | `fechaFactura: toNoonUtc(input.fechaFactura)` |
| `features/accounting/iva-books/iva-books.repository.ts` | 317 | `fechaFactura: new Date(input.fechaFactura)` | `fechaFactura: toNoonUtc(input.fechaFactura)` |
| `features/accounting/iva-books/iva-books.repository.ts` | 378 | `fechaFactura: new Date(input.fechaFactura)` | `fechaFactura: toNoonUtc(input.fechaFactura)` |
| `features/dispatch/dispatch.repository.ts` | 148 | `date: input.date` (pass-through string) | `date: toNoonUtc(input.date)` — see D.6 |

**REVISION vs proposal**: The proposal § Affected Areas listed `iva-books.repository.ts` as **None** and `dispatch.repository.ts` as **None**. The design REVISES this in two places:

1. **IVA books** — proposal is technically correct that the existing read path (`toISOString().slice(0,10)` at lines 64, 130) works for UTC-midnight rows. But the WRITE path at lines 189, 258, 317, 378 has the exact same `new Date(input.fechaFactura)` bug; any new IVA book row persisted after this change lands would still be UTC-midnight while Sale and Purchase rows are UTC-noon. That **inconsistent storage across tables** is worse than the original bug — it masks the problem for IVA specifically and will resurface when someone builds a new display path for `fechaFactura`. Design DECIDES: include IVA book repo in the noon-UTC migration.

2. **Dispatch** — see D.6 for detailed reasoning.

### Validation upstream

`sale.validation.ts`, `purchase.validation.ts`, `dispatch.validation.ts`, `iva-books.validation.ts` all validate `date` / `fechaFactura` as `z.string().min(1)` (per exploration § "Server validation"). No change needed there — `toNoonUtc` gets a non-empty string and will throw `RangeError` only on genuinely malformed payloads, which is correct fail-fast behaviour.

---

## D.4 — Test strategy

### D.4.1 — Unit tests for `lib/date-utils.ts`

New file: `lib/__tests__/date-utils.test.ts`. Vitest.

**`todayLocal()` cases** — all use `vi.useFakeTimers()` + `vi.setSystemTime()`:

| Scenario | System time (as string arg to `setSystemTime`) | Expected `todayLocal()` |
|----------|-----------------------------------------------|-------------------------|
| Normal midday | `"2026-04-17T15:00:00-04:00"` (L=15:00 Apr 17) | `"2026-04-17"` |
| **Critical regression case** — before-midnight | `"2026-04-17T23:00:00-04:00"` (L=23:00 Apr 17 → UTC=03:00 Apr 18) | `"2026-04-17"` ← the bug case |
| Right after local midnight | `"2026-04-18T00:30:00-04:00"` | `"2026-04-18"` |
| Year boundary | `"2026-12-31T23:45:00-04:00"` | `"2026-12-31"` |
| Single-digit month/day zero-padding | `"2026-01-05T10:00:00-04:00"` | `"2026-01-05"` |

**`formatDateBO(value)` cases**:

| Input | Expected |
|-------|----------|
| `"2026-04-17"` | `"17/04/2026"` |
| `"2026-04-17T00:00:00.000Z"` (legacy UTC-midnight row) | `"17/04/2026"` |
| `"2026-04-17T12:00:00.000Z"` (new UTC-noon row) | `"17/04/2026"` |
| `new Date("2026-04-17T00:00:00.000Z")` (Date instance) | `"17/04/2026"` |
| `new Date("2026-04-17T12:00:00.000Z")` | `"17/04/2026"` |
| `"2026-01-05"` (single-digit pad) | `"05/01/2026"` |
| `null` | `""` |
| `undefined` | `""` |
| `""` | `""` |
| `"garbage"` (<10 chars or malformed) | `""` |

**`toNoonUtc(yyyymmdd)` cases**:

| Input | Expected (as ISO string) |
|-------|--------------------------|
| `"2026-04-17"` | `"2026-04-17T12:00:00.000Z"` |
| `"2026-04-17T09:30:00.000Z"` (full ISO — truncated to first 10) | `"2026-04-17T12:00:00.000Z"` |
| `""` | throws `RangeError` |
| `"abcd"` | throws `RangeError` |

**Mock "current time" recipe** (copy into test file boilerplate):
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("todayLocal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns local date at 23:00 UTC-4 (regression: UTC would say tomorrow)", () => {
    vi.setSystemTime(new Date("2026-04-17T23:00:00-04:00"));
    expect(todayLocal()).toBe("2026-04-17");
  });
});
```

**Note on `vi.setSystemTime` timezone caveat**: The string `"2026-04-17T23:00:00-04:00"` is parsed as an absolute instant (`2026-04-18T03:00:00Z`). `todayLocal()` calls `getFullYear`/`getMonth`/`getDate` which read in the PROCESS timezone, not a fabricated one. For the test to assert "2026-04-17", the test runner's `TZ` env must be set to `America/La_Paz` (or any UTC-4 zone). **DECISION**: set `TZ=America/La_Paz` in Vitest config (`vitest.config.ts` → `env: { TZ: "America/La_Paz" }`) OR prefix the test script in `package.json`. Check existing Vitest config and add the env var; if it is already globally set for other tests, document it in the test file comment.

### D.4.2 — Tests that will break

Per proposal § Risks: "Existing tests asserting exact date strings (`"2025-03-15"` or `"15/3/2025"`) break when routed through `formatDateBO`".

Audit candidates (will be confirmed during `sdd-apply`):
- `features/sale/__tests__/**` — any test rendering a sale header or list and asserting a formatted date string.
- `components/sales/__tests__/**` — snapshot / DOM-text tests on sale-form or sale-list.
- `features/purchase/__tests__/**`, `components/purchases/__tests__/**` — same.
- `features/dispatch/__tests__/**`, `components/dispatches/__tests__/**` — same.
- `features/accounting/iva-books/__tests__/**` — if any assert `fechaFactura` render.

Migration pattern is mechanical:
- `"15/3/2025"` → `"15/03/2025"`
- `"15 mar 2025"` → `"15/03/2025"`
- Server-side tests asserting stored instant: `expect(row.date.toISOString()).toBe("2025-03-15T00:00:00.000Z")` → `"2025-03-15T12:00:00.000Z"`.

**Migration rule**: fix tests **in the same commit as the code change that broke them** — never separate the rename from the test update. Per project convention (Strict TDD Mode enabled): failing tests first, code change, tests green. For this change, that means:

1. Add unit tests for `date-utils.ts` (PR1) — RED until utility is written, GREEN after.
2. For each consumer swap, if the existing test breaks, update the assertion in the SAME commit.

### D.4.3 — Playwright / e2e

Out of scope for this design. No new e2e test required — the unit layer + spec scenarios cover the regression.

---

## D.5 — Form default migration pattern

**The `<input type="date">` element requires `"YYYY-MM-DD"` as its value.** `formatDateBO` returns `"DD/MM/YYYY"` — NOT usable. So we have a split concern:

| Concern | Helper | Format |
|---------|--------|--------|
| Form input VALUE (`<input type="date" value={…}>`) | `todayLocal()` (new record) OR existing `.toISOString().split("T")[0]` pattern (edit mode) | `"YYYY-MM-DD"` |
| Form / list DISPLAY (read-only `<dd>` cells, list columns) | `formatDateBO(value)` | `"DD/MM/YYYY"` |

### Decision: no new helper for input values

The existing edit-mode pattern is SAFE (exploration § 8 proves it). Introducing `formatDateForInput(value): string` to wrap three chars of trivial `.toISOString().split("T")[0]` would be net-negative. The ONLY swap on form defaults is the "new record" branch:

```ts
// BEFORE — sale-form.tsx:153-157, dispatch-form.tsx:289-292, purchase-form.tsx:213-215
const [date, setDate] = useState(
  sale?.date
    ? new Date(sale.date).toISOString().split("T")[0]   // edit branch — KEEP
    : new Date().toISOString().split("T")[0],            // new branch — SWAP
);

// AFTER
const [date, setDate] = useState(
  sale?.date
    ? new Date(sale.date).toISOString().split("T")[0]   // edit branch — unchanged
    : todayLocal(),                                      // new branch — now correct locally
);
```

**IVA modal pre-fill lines** (`sale-form.tsx:1085`, `purchase-form.tsx:1637`) remain unchanged — they fill an `<input type="date">` with `"YYYY-MM-DD"`, the existing pattern is correct, proposal § Out of Scope confirms.

**Other form defaults** (all new-record branches) use the same swap:
- `components/payments/payment-form.tsx:206`
- `components/lots/create-lot-dialog.tsx:35, 74, 95`
- `components/expenses/create-expense-form.tsx:53, 87, 108`
- `components/mortality/log-mortality-form.tsx:35, 68, 88`
- `components/accounting/journal-entry-form.tsx:82`
- `components/accounting/create-journal-entry-form.tsx:60`
- `components/purchases/purchase-form.tsx:241` (FLETE detail `fecha` re-fill)

### Display swap pattern

```tsx
// BEFORE — sale-form.tsx:545
<dd>{new Date(sale!.date).toLocaleDateString("es-BO")}</dd>

// AFTER
<dd>{formatDateBO(sale!.date)}</dd>
```

Allocation rows likewise:
```tsx
// BEFORE — sale-form.tsx:888, dispatch-form.tsx:1444, purchase-form.tsx:1465
{new Date(alloc.payment.date).toLocaleDateString("es-BO")}

// AFTER
{formatDateBO(alloc.payment.date)}
```

List views inline `formatDate(date)`:
```tsx
// BEFORE — sale-list.tsx:55-61 (and dispatch-list, purchase-list, payment-list, journal entry list)
function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("es-BO", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// AFTER
import { formatDateBO } from "@/lib/date-utils";
// ... delete local formatDate; inline call becomes formatDateBO(row.date)
```

**REVISION vs proposal**: proposal § Affected Areas listed only the three main list files. The audit in D.2 shows **journal/ledger/period/receivable/payable/payment list** files also use `toLocaleDateString("es-BO", {...})`. Decision: migrate the comprobante + payment set in this change (sale/dispatch/purchase/payment), LEAVE accounting (journal, ledger, period, receivable, payable, reports, income-statement) for a follow-up — they are not part of the user-reported bug surface and expanding scope risks the PR becoming unreviewable.

---

## D.6 — Dispatch repo pass-through question

**Proposal said**: leave `dispatch.repository.ts:148` alone (`date: input.date` string pass-through).

**Investigation** — Prisma 7.7 `DateTime` field accepting a bare string:

- Prisma runtime passes the value through its serializer, which calls `new Date(value)` for string inputs on `DateTime` fields. For a bare `"2026-04-17"`, this is `new Date("2026-04-17")` → `2026-04-17T00:00:00.000Z` (UTC midnight). Exact same bug as sale/purchase.
- There is no ECMAScript rule that flips to local parsing for date-only strings — the spec (§ 21.4.3.2, Date Time String Format) explicitly parses bare date strings as UTC.

**Conclusion**: The dispatch write path has the same UTC-midnight storage as sale and purchase. The display-layer fix (`formatDateBO`) DOES cover this correctly for the read side — so strictly speaking, leaving it alone is not a CORRECTNESS bug.

**Decision**: **INCLUDE `dispatch.repository.ts:148` in the noon-UTC swap.** Reasoning:

1. Consistency across the three comprobante tables (Sale, Purchase, Dispatch) — future devs inspecting raw DB rows see one storage convention. UTC-midnight vs UTC-noon as a mixed storage is a minefield.
2. The Prisma pass-through is NOT an independent code path — it's the same bug, just moved one level down. Fixing it at the repository layer keeps the rule "repository normalizes" uniform.
3. Risk is near-zero: one-line change, the same helper, the same semantic.
4. Rollback story is identical for all three repositories.

The proposal § Out of Scope sentence on dispatch is **REVISED** by this design. Flag it in the archive/verify phase.

Also add the update path if not already present:

```ts
// dispatch.repository.ts update() — if input.date is present:
date: toNoonUtc(input.date)
```

(Verify during `sdd-apply` whether `dispatch.repository.ts` has an `update` method that writes `date`; if yes, swap; if no, no-op.)

---

## D.7 — Rollout order (PR sequence)

Four PRs, each green on its own. Each subsequent PR depends on the previous but does not require the previous to be merged — they can queue, but the suggested merge order is linear:

### PR1 — Create `lib/date-utils.ts` + unit tests

- Files: `lib/date-utils.ts` (new), `lib/__tests__/date-utils.test.ts` (new), `vitest.config.ts` (add `env.TZ = "America/La_Paz"` if not already set).
- **Zero consumers**. Ship in isolation.
- Green criteria: all unit tests from D.4.1 pass.
- Risk: none. Pure addition.

### PR2 — Server repo normalization

- Files: `features/sale/sale.repository.ts` (2+1 lines), `features/purchase/purchase.repository.ts` (2+1 lines), `features/accounting/iva-books/iva-books.repository.ts` (4 lines), `features/dispatch/dispatch.repository.ts` (1+? line).
- After PR2: new records are at UTC-noon; legacy records remain at UTC-midnight. Both groups display correctly via the OLD `toLocaleDateString` path (because noon UTC is unambiguous), so UI is unaffected.
- Green criteria: existing repository tests still pass after updating the two or three assertions that hard-code `T00:00:00.000Z` to `T12:00:00.000Z` (same-commit test migration per D.4.2).
- Risk: Low. Covered by existing repository tests.

### PR3 — Form defaults swap (`todayLocal`)

- Files: all form files listed in D.5 (sale/dispatch/purchase/payment/lots/expenses/mortality/journal-entry).
- After PR3: user-opening-form-at-21:00-L now sees today's local date (not tomorrow's UTC date).
- Green criteria: existing form tests pass; add a smoke test for the "23:00 local" case on at least one form if feasible.
- Risk: Low. Mechanical swap.

### PR4 — Display swap (`formatDateBO`) + test migrations

- Files: sale/dispatch/purchase forms (read-only header + allocation rows); sale/dispatch/purchase/payment lists (replace local `formatDate` helper with `formatDateBO` import).
- After PR4: all comprobante dates render `DD/MM/YYYY` with zero-pad, both for new (UTC-noon) and legacy (UTC-midnight) rows.
- Green criteria: tests asserting the old `"17/4/2026"` / `"17 abr 2026"` formats updated to `"17/04/2026"` in the same commit.
- Risk: Medium. Highest test-churn PR. Flag the visual shift in the PR description.

---

## D.8 — Open decisions

**None.** Every decision is committed. Notes for the archive phase:

- Proposal stated "IVA books repository — None" and "Dispatch repository — None"; design REVISED both to include them. `sdd-verify` should confirm the revised scope was applied and not regress toward the proposal's narrower list.
- The accounting / ledger / period / receivable / payable / reports list files are EXPLICITLY DEFERRED from PR4 scope — separate ticket.
- `saleFiltersSchema.z.coerce.date()` remains deferred per proposal. Unchanged.

---

## Skill compliance

- **TypeScript 5.9 strict**: all three signatures use explicit return types. `null | undefined` input on `formatDateBO` is part of the public contract and tested.
- **React 19**: no server-component churn; all swaps are in `"use client"` files.
- **Prisma 7.7**: noon-UTC `Date` writes work verbatim on `DateTime` fields; no migration, no schema change.
- **Clerk**: unaffected.
- **No `@testing-library/user-event`**: confirmed — unit tests for `date-utils.ts` are pure function tests, no DOM.
- **No `"use server"`**: repository swaps happen in existing feature repositories; the call path from API route → repository is unchanged.
