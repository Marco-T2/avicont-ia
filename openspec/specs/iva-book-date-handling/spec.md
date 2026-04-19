# Spec: iva-book-date-handling

## Change: `fix-comprobante-date-tz`

---

## Domain: `iva-book-date-handling`

> **Context**: `features/accounting/iva-books/iva-books.repository.ts` has four call sites (lines 189, 258, 317, 378) that construct a `Date` for `fechaFactura` using `new Date(row.fechaFactura)` or similar patterns before writing back to the database. The exploration identified that these writes do NOT include the `"T12:00:00.000Z"` suffix, meaning they inherit the same UTC-midnight storage risk as the sale/purchase repos. This spec requires noon-UTC normalization at all four sites.
>
> **Read paths** (`iva-books.repository.ts:64, 130`): these already use `toISOString().slice(0, 10)` which is safe for UTC-midnight rows — they are NOT changed by this fix.
>
> **IvaBookPurchaseModal / IvaBookSaleModal pre-fill**: the modal pre-fill path `new Date(x).toISOString().split("T")[0]` is safe for `<input type="date">` values per the exploration analysis and is explicitly out of scope.

---

### REQ-E.1 — `iva-books.repository.ts` stores `fechaFactura` at noon UTC (4 write sites)

In `features/accounting/iva-books/iva-books.repository.ts`, every write path that constructs a `Date` for `fechaFactura` MUST normalize to noon UTC by appending `"T12:00:00.000Z"` to the `"YYYY-MM-DD"` input string before wrapping in `new Date(...)`.

**Affected locations**: lines 189, 258, 317, 378.

The pattern to apply at each site:

```ts
// Before:
fechaFactura: new Date(input.fechaFactura)

// After:
fechaFactura: new Date(input.fechaFactura + "T12:00:00.000Z")
```

If the input is already a full ISO string (not a bare date string), the repository MUST extract the `"YYYY-MM-DD"` portion first (via `.slice(0, 10)`) before appending the noon suffix, to avoid double time-component appending.

#### Scenario: IVA book create stores fechaFactura at noon UTC

- GIVEN an IVA book create payload with `fechaFactura: "2026-04-17"`
- WHEN the repository write at line 189 executes
- THEN the value written to the database is `2026-04-17T12:00:00.000Z`
- AND it is NOT `2026-04-17T00:00:00.000Z`

#### Scenario: All four write sites produce noon-UTC values

- GIVEN four separate IVA book write operations (create purchase, create sale, update purchase, update sale) each with `fechaFactura: "2026-04-17"`
- WHEN each write executes (lines 189, 258, 317, 378)
- THEN each stored value is `2026-04-17T12:00:00.000Z`
- AND none store `2026-04-17T00:00:00.000Z`

#### Scenario: Existing UTC-midnight `fechaFactura` values display correctly via formatDateBO

- GIVEN an existing IVA book row has `fechaFactura = 2026-04-17T00:00:00.000Z` (stored before this fix)
- WHEN any display layer calls `formatDateBO` on the serialized ISO string
- THEN the output is `"17/04/2026"`
- AND the record does NOT require a data migration to display correctly

#### Scenario: Read path is unaffected — `toISOString().slice(0,10)` remains safe

- GIVEN `iva-books.repository.ts:64` or `iva-books.repository.ts:130` reads `fechaFactura` and calls `.toISOString().slice(0, 10)`
- WHEN the row was stored at either UTC midnight (`T00:00:00.000Z`) or UTC noon (`T12:00:00.000Z`)
- THEN the returned `"YYYY-MM-DD"` string is `"2026-04-17"` in both cases
- AND no change to these read paths is required
