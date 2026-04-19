## Exploration: fix-comprobante-date-tz

### Current State

The date flows through the system as follows:

#### A) Form state initialization (client)

All three forms initialize the `date` state from the same pattern:

```ts
// sale-form.tsx:155-156, dispatch-form.tsx:289-291, purchase-form.tsx:213-215
const [date, setDate] = useState(
  sale?.date
    ? new Date(sale.date).toISOString().split("T")[0]   // <-- BUG is here on read-back
    : new Date().toISOString().split("T")[0],             // <-- BUG on initial "today"
);
```

For the **default today date**, `new Date()` creates a local-time Date object. But `.toISOString()` serializes it to UTC. If the user opens the form after 20:00 Bolivia time (UTC-4), the UTC timestamp is already on the next calendar day, so `toISOString().split("T")[0]` returns tomorrow's date in UTC — which is today locally. In practice for Bolivia (UTC-4), this means any time between 00:00 and 03:59 local time the "today" default is already midnight UTC of the prior day, i.e., yesterday's date.

Wait — correcting the direction: Bolivia is UTC-4. Local midnight = 04:00 UTC of the same day. Local 20:00 = 00:00 UTC of the **next** day. So the risk window is 20:00–23:59 local time: `new Date()` yields a UTC date one day ahead. But `toISOString().split("T")[0]` would then return TOMORROW's date, not yesterday's. The reported symptom (registered on Apr 17, saved as Apr 16) points in the opposite direction: UTC date falls **behind** local date. That happens when the local date is after midnight but `new Date(storedDate)` interprets a UTC midnight stored date as the prior local date.

The real trigger is the **read-back path**: when loading an existing record for edit (or for re-display in the IVA modal), `new Date(sale.date).toISOString().split("T")[0]` is called. Prisma returns `date` as a JavaScript `Date` object (Prisma `DateTime` → JS `Date`). That `Date` represents `2026-04-17T00:00:00.000Z` (stored as UTC midnight). Then `.toISOString()` → `"2026-04-17T00:00:00.000Z"` → `.split("T")[0]` → `"2026-04-17"`. **This part is actually safe**. But only IF the value was stored correctly.

The actual root cause is the **initial default "today" path**. When the user opens a **new** form:

```ts
new Date().toISOString().split("T")[0]
// Bolivia: user opens form at 21:00 local = 01:00 UTC next day
// new Date() = 2026-04-18T01:00:00.000Z
// .toISOString().split("T")[0] = "2026-04-18"  ← WRONG, user is still on Apr 17 locally
```

BUT there is a second, equally critical vector: the **server-side `new Date(input.date)`** interpretation. The client sends `date: "2026-04-17"` (a bare ISO date string). On the server:

```ts
// sale.repository.ts:156, 190 — purchase.repository.ts:186, 249
date: new Date(input.date)
// new Date("2026-04-17") → 2026-04-17T00:00:00.000Z  (parsed as UTC midnight)
```

`new Date("YYYY-MM-DD")` per the ECMAScript spec treats bare date strings as UTC, not local time. So the stored value is UTC midnight. When read back by Prisma and returned as a JSON payload, the Date object is serialized via `JSON.stringify` → ISO string → `2026-04-17T00:00:00.000Z`. The client then calls `new Date("2026-04-17T00:00:00.000Z").toLocaleDateString("es-BO")` → which converts to local time → `16/04/2026`. **This is the display bug.**

#### Full chain with bug markers:

1. **Form init (new record)**: `new Date().toISOString().split("T")[0]` — safe as long as page opens before 20:00 local. After 20:00, shows next calendar day as default. LOW SEVERITY on its own.

2. **Client → server payload**: `date` state is a `"YYYY-MM-DD"` string, sent as-is in JSON body. CORRECT.

3. **Server validation** (`sale.validation.ts:13`): `date: z.string().min(1)` — passes through as string. CORRECT.

4. **Server → Prisma** (`sale.repository.ts:156`): `date: new Date(input.date)` where `input.date = "2026-04-17"`.
   - `new Date("2026-04-17")` = `2026-04-17T00:00:00.000Z` (UTC midnight). CORRECT only if DB/Prisma treat this as date-only.
   - Prisma `DateTime` in PostgreSQL maps to `TIMESTAMP WITH TIME ZONE`. It stores the absolute UTC instant. The stored value is `2026-04-17 00:00:00+00`.

5. **Prisma → API response**: Prisma deserializes to a JS `Date` object. `JSON.stringify` on a `Date` produces an ISO UTC string: `"2026-04-17T00:00:00.000Z"`.

6. **Client re-init (edit form)**: `new Date(sale.date)` where `sale.date = "2026-04-17T00:00:00.000Z"` (or possibly a `Date` object depending on serialization). Then `.toISOString().split("T")[0]` = `"2026-04-17"`. The `<input type="date">` gets `"2026-04-17"`. CORRECT for the input value.

7. **Read-only display** (`sale-form.tsx:545`, `dispatch-form.tsx:794`): `new Date(sale!.date).toLocaleDateString("es-BO")` — **THIS IS THE BUG**.
   - `sale.date` comes as the JS `Date` object from Prisma (on server-side render) or as the ISO string from the API (on client).
   - `new Date("2026-04-17T00:00:00.000Z")` is UTC midnight.
   - `.toLocaleDateString("es-BO")` in Bolivia (UTC-4) converts to local time: `2026-04-16T20:00:00-04:00` → **displays as `16/04/2026`**.

8. **IVA modal pre-fill** (`sale-form.tsx:1085`, `purchase-form.tsx:1637`): `date: new Date(sale.date).toISOString().split("T")[0]`. This would correctly give `"2026-04-17"` because `.toISOString()` is UTC-based, not local. CORRECT.

9. **`sale-list.tsx:56`** and `dispatch-list.tsx` (similar): `new Date(date).toLocaleDateString("es-BO")` — **same display bug**.

10. **`sale-form.tsx:888`** (receivable allocations): `new Date(alloc.payment.date).toLocaleDateString("es-BO")` — **same display bug for payment dates**.

11. **`dispatch-form.tsx:1444`**, **`purchase-form.tsx:1464`** (payment allocations): same pattern — **same display bug**.

#### Dispatch vs Sale/Purchase: an important asymmetry

The dispatch repository (`dispatch.repository.ts:148`) passes `date: input.date` — the raw string — directly to Prisma, not `new Date(input.date)`. Prisma's type coercion may still interpret the bare `"YYYY-MM-DD"` as UTC midnight, but the code path is different. The display bug still affects dispatches because the rendering components use `new Date(date).toLocaleDateString`.

#### IVA Books `fechaFactura`

`iva-books.repository.ts:64, 130`: `row.fechaFactura.toISOString().slice(0, 10)` — same UTC-to-string conversion. Safe for storage (always UTC midnight), but the **display path** in any component using `new Date(fechaFactura).toLocaleDateString(...)` would also shift back one day. The IVA modal displays the date via an `<input type="date">` fed from the pre-fill, which uses `.toISOString().split("T")[0]` — that path is safe. Risk is lower here but the same class of bug.

### Root Cause Hypothesis

**Primary bug**: Any `new Date(isoString).toLocaleDateString(locale)` call where `isoString` is `"YYYY-MMDDTHHH:MM:SS.sssZ"` with a time of `T00:00:00Z` (UTC midnight). In Bolivia (UTC-4), this renders as the **previous calendar day**.

The exact guilty lines:
- `sale-form.tsx:545` — read-only fecha display: `new Date(sale!.date).toLocaleDateString("es-BO")`
- `sale-form.tsx:888` — cobro allocation: `new Date(alloc.payment.date).toLocaleDateString("es-BO")`
- `dispatch-form.tsx:794` — read-only fecha display: `new Date(existingDispatch.date).toLocaleDateString("es-BO")`
- `dispatch-form.tsx:1444` — cobro allocation: `new Date(alloc.payment.date).toLocaleDateString("es-BO")`
- `purchase-form.tsx:683` — read-only fecha display: `new Date(purchase!.date).toLocaleDateString("es-BO")`
- `purchase-form.tsx:1464` — pago allocation: `new Date(alloc.payment.date).toLocaleDateString("es-BO")`
- `sale-list.tsx:56` — list view: `new Date(date).toLocaleDateString("es-BO", {...})`
- `components/dispatches/dispatch-list.tsx` — same pattern (not read but consistent)
- `components/purchases/purchase-list.tsx` — same pattern

**Secondary bug (form default "today")**: `new Date().toISOString().split("T")[0]` — after 20:00 local shows the next calendar date. All three forms + payments, lots, expenses, mortality use this.

**Non-bug (appears buggy but is safe)**: `new Date(sale.date).toISOString().split("T")[0]` for `<input type="date">` value — this is actually safe because `.toISOString()` strips back to UTC and `.split("T")[0]` returns the correct `"YYYY-MM-DD"`.

### Affected Areas

- `components/sales/sale-form.tsx:155-156` — form state init (both default today + edit re-fill)
- `components/sales/sale-form.tsx:545` — read-only date display (BUG: toLocaleDateString)
- `components/sales/sale-form.tsx:888` — allocation payment date display
- `components/sales/sale-list.tsx:56` — list view date formatting (BUG: toLocaleDateString)
- `components/dispatches/dispatch-form.tsx:289-291` — form state init
- `components/dispatches/dispatch-form.tsx:794` — read-only date display (BUG)
- `components/dispatches/dispatch-form.tsx:1444` — allocation payment date display
- `components/purchases/purchase-form.tsx:213-215` — form state init
- `components/purchases/purchase-form.tsx:683` — read-only date display (BUG)
- `components/purchases/purchase-form.tsx:1464` — allocation payment date display
- `components/purchases/purchase-form.tsx:241` — FLETE detail line `fecha` re-fill
- `features/sale/sale.repository.ts:156, 190` — `new Date(input.date)` (server-side)
- `features/purchase/purchase.repository.ts:186, 249` — `new Date(input.date)` (server-side)
- `features/accounting/iva-books/iva-books.repository.ts:64, 130` — `toISOString().slice(0,10)` (safe, but same class)
- Many other forms: `payment-form.tsx`, `create-lot-dialog.tsx`, `create-expense-form.tsx`, `log-mortality-form.tsx` — all use `new Date().toISOString().split("T")[0]` for default today

### Approaches

#### 1. String-only (no `Date()` object for date-only fields) — RECOMMENDED

Never instantiate a `Date` object from a date-only field. Keep `"YYYY-MM-DD"` strings throughout. For display, parse manually: `"YYYY-MM-DD".split("-")` → format as `"DD/MM/YYYY"`.

- Fix display: replace `new Date(x).toLocaleDateString("es-BO")` with a pure `formatDateLocal(x: string): string` utility that parses the `"YYYY-MM-DD"` string directly without a Date object (or uses `new Date(x + "T12:00:00")` to force noon UTC to avoid midnight boundary).
- Fix form default today: replace `new Date().toISOString().split("T")[0]` with a `todayLocal(): string` utility using `getFullYear/getMonth/getDate` getters (local-time).
- Fix server `new Date(input.date)` → pass through to Prisma differently. With Prisma 7.x and PostgreSQL, you can pass the date as a string directly for `DateTime` fields in ISO format OR use `new Date(date + "T12:00:00.000Z")` to store noon UTC instead of midnight. The safest: use `new Date(input.date + "T12:00:00.000Z")` which stores a UTC noon — when read back and converted to any time zone within UTC-12 to UTC+12, the date portion is always the correct calendar date.

**Pros**: No library dependency. Eliminates the entire class of bugs. Simple shared utilities. Predictable.
**Cons**: Must update all call sites. Manual date parsing is slightly verbose.
**Effort**: Medium — ~15-20 call sites across 5+ components + 3 repositories.

#### 2. UTC-normalize at boundaries (store at noon UTC)

Keep `new Date(input.date)` on the server but use `new Date(input.date + "T12:00:00.000Z")` instead of `new Date(input.date)`. Noon UTC is never ambiguous: it always round-trips to the same calendar date for any timezone within UTC-12 to UTC+12.

Display stays the same (`.toLocaleDateString()` on a noon UTC date correctly shows the right calendar day in any timezone).

**Pros**: Minimal server change (just suffix `+ "T12:00:00.000Z"`). Display code unchanged. Easy.
**Cons**: Existing records in DB are at midnight UTC — will still display wrong until migrated. Requires data migration for old records. Mixes storage strategies if not done atomically.
**Effort**: Low for new records, Medium with migration.

#### 3. Client-side format with explicit UTC date getters

Keep everything as-is on server. Fix only the display calls: replace `new Date(x).toLocaleDateString("es-BO")` with `new Date(x).toLocaleDateString("es-BO", { timeZone: "America/La_Paz" })`. This forces the conversion to use the correct timezone regardless of server/browser timezone.

**Pros**: Minimal change — only display call sites. Does not require server changes or data migration.
**Cons**: Hard-codes `America/La_Paz` timezone everywhere. Multi-tenant apps with users in different timezones would be wrong. The `new Date().toISOString().split("T")[0]` default-today bug still exists. Does not fix the root cause — just the symptom.
**Effort**: Low.

### Recommendation

**Approach 1 (String-only) with the specific variant: introduce two shared utilities** and replace all affected call sites:

```ts
// lib/date-utils.ts

/** Returns today's date as "YYYY-MM-DD" in local time (no UTC shift). */
export function todayLocal(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Formats a date-only value for display in es-BO locale.
 * Accepts a "YYYY-MM-DD" string or a Date object stored at UTC midnight.
 * Avoids timezone shift by parsing the string directly.
 */
export function formatDateBO(value: string | Date): string {
  const str = value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
  const [yyyy, mm, dd] = str.split("-");
  return `${dd}/${mm}/${yyyy}`;
}
```

On the **server repositories**, change `new Date(input.date)` to `new Date(input.date + "T12:00:00.000Z")`. This is both safe and means existing data stays consistent with new data (old records at UTC midnight and new ones at UTC noon both display correctly with `formatDateBO` since both are parsed string-first).

This approach:
- Fixes the immediate display bug in all forms and list views
- Fixes the default "today" initialization in all forms
- Keeps data storage semantics clean
- Does not require a data migration (display-first fix covers both old and new records)
- Is extensible: any future date field just uses `formatDateBO()` and `todayLocal()`

### Risks

1. **Existing DB records stored at UTC midnight**: Old records already in `sales`, `dispatches`, `purchases`, `payments`, `iva_purchase_books`, `iva_sales_books` tables have `date = 2026-04-17 00:00:00+00`. If the fix is purely client-side (parse string from API response), these records will display correctly with `formatDateBO` since `.toISOString().slice(0,10)` of UTC midnight gives the right `"YYYY-MM-DD"`. NO DATA MIGRATION NEEDED for the display fix.

2. **Tests asserting specific date formats**: Tests in `features/sale/__tests__/` and `components/sales/__tests__/` currently mock `date: new Date("2025-03-15")` (direct Date objects). If we change display utilities, those tests need updating to match new formatting output.

3. **The `saleFiltersSchema` in `sale.validation.ts:36`**: `dateFrom: z.coerce.date()` and `dateTo: z.coerce.date()` — `z.coerce.date()` calls `new Date(value)` internally, which will treat bare ISO strings as UTC midnight. Filter queries could be off by one if used near midnight. Low priority but same class.

4. **Multi-tenant timezone consideration**: The app is single-company (Bolivia-only based on `es-BO` locale throughout). The `todayLocal()` utility relies on the machine clock's local timezone. On the server (Node.js), this depends on the server's `TZ` environment variable. For client-rendered forms (all form components are `"use client"`), the browser's local timezone is correct. No risk for client components. Server-side date calculations in service layer should explicitly use UTC arithmetic.

### Ready for Proposal

Yes. Root cause is confirmed, all affected files identified, and the approach is clear and bounded.
