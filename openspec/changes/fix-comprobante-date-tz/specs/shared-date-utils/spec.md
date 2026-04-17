# Spec: shared-date-utils

## Change: `fix-comprobante-date-tz`

---

## Domain: `shared-date-utils` — NEW

### REQ-A.1 — `todayLocal()` returns current local calendar day as `"YYYY-MM-DD"`

`lib/date-utils.ts` MUST export a pure function `todayLocal(): string` that returns the current date as a zero-padded `"YYYY-MM-DD"` string using **local-time getters** (`getFullYear`, `getMonth`, `getDate`) on `new Date()`. It MUST NOT use `toISOString()` or any UTC-based getter for the calendar day calculation. The function is intended for `"use client"` contexts only; JSDoc MUST note it should not be called server-side unless the process `TZ` env is explicitly set.

#### Scenario: Correct local day at 21:00 Bolivia time (UTC-4, crosses midnight UTC)

- GIVEN the system clock is at 2026-04-17T21:00:00 local Bolivia time (= 2026-04-18T01:00:00Z)
- WHEN `todayLocal()` is called in that browser environment
- THEN the return value is `"2026-04-17"`
- AND it is NOT `"2026-04-18"` (which `new Date().toISOString().split("T")[0]` would have returned)

#### Scenario: Correct local day at 08:00 Bolivia time (safe window)

- GIVEN the system clock is at 2026-04-17T08:00:00 local Bolivia time (= 2026-04-17T12:00:00Z)
- WHEN `todayLocal()` is called
- THEN the return value is `"2026-04-17"`

#### Scenario: Return value is zero-padded

- GIVEN the system clock represents a single-digit month and single-digit day (e.g. local date 2026-03-05)
- WHEN `todayLocal()` is called
- THEN the return value is `"2026-03-05"` (with leading zeros on month and day)
- AND it is NOT `"2026-3-5"`

---

### REQ-A.2 — `formatDateBO(value)` returns `"DD/MM/YYYY"` via string parsing, never via `toLocaleDateString`

`lib/date-utils.ts` MUST export `formatDateBO(value: string | Date): string` that:

1. If `value` is a `Date` instance, calls `.toISOString()` to obtain the UTC ISO string, then slices the first 10 characters to get `"YYYY-MM-DD"`.
2. If `value` is a string, uses the first 10 characters directly (assumes ISO-8601 `"YYYY-MM-DD..."` prefix).
3. Splits the 10-char segment on `"-"` to extract `[yyyy, mm, dd]`.
4. Returns `"${dd}/${mm}/${yyyy}"`.
5. MUST NOT call `Date.prototype.toLocaleDateString` at any point.
6. MUST NOT instantiate a `new Date(...)` for the purpose of formatting a string input.

#### Scenario: UTC-midnight string renders correct calendar day

- GIVEN the stored DB value serializes as `"2026-04-17T00:00:00.000Z"`
- WHEN `formatDateBO("2026-04-17T00:00:00.000Z")` is called in a Bolivia (UTC-4) browser
- THEN the return value is `"17/04/2026"`
- AND it is NOT `"16/04/2026"` (which `new Date(x).toLocaleDateString("es-BO")` would have returned)

#### Scenario: Noon-UTC stored value renders correct calendar day

- GIVEN a new record was stored with `"2026-04-17T12:00:00.000Z"`
- WHEN `formatDateBO("2026-04-17T12:00:00.000Z")` is called
- THEN the return value is `"17/04/2026"`

#### Scenario: Bare `"YYYY-MM-DD"` string input

- GIVEN the value is `"2026-04-17"` (no time component)
- WHEN `formatDateBO("2026-04-17")` is called
- THEN the return value is `"17/04/2026"`

#### Scenario: `Date` instance input

- GIVEN a `Date` object is constructed as `new Date("2026-04-17T00:00:00.000Z")`
- WHEN `formatDateBO(dateInstance)` is called
- THEN the return value is `"17/04/2026"`

---

### REQ-A.3 — Edge cases: `null`/`undefined`, invalid strings, already-a-`Date`

`formatDateBO` MUST handle gracefully the inputs below without throwing:

| Input | Expected output |
|-------|----------------|
| `null` / `undefined` | `""` (empty string) |
| `""` (empty string) | `""` |
| A string shorter than 10 chars (e.g. `"2026-04"`) | `""` |
| A non-ISO string (e.g. `"not-a-date"`) | `""` (or at worst the literal `"te/no-/a-d"` — implementation MUST guard to return `""` when digit segments are not 4/2/2 chars) |
| A `Date` with `NaN` time (`new Date("invalid")`) | `""` |

`todayLocal` has no nullability concern (it uses the live clock); no edge-case handling is required beyond the zero-padding specified in REQ-A.1.

#### Scenario: `null` input returns empty string

- GIVEN `formatDateBO` is called with `null` (cast to `string | Date`)
- WHEN the function executes
- THEN it returns `""`
- AND it does NOT throw

#### Scenario: Invalid `Date` instance returns empty string

- GIVEN a `Date` object constructed from an invalid string (`new Date("bad")`) with `isNaN(date.getTime()) === true`
- WHEN `formatDateBO(invalidDate)` is called
- THEN it returns `""`
- AND it does NOT throw

#### Scenario: String too short returns empty string

- GIVEN the input string is `"2026-04"` (7 chars, no day component)
- WHEN `formatDateBO("2026-04")` is called
- THEN it returns `""`
