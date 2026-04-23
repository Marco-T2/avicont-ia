# Design: fiscal-period-form-ux

## Technical Approach

Enrich `PeriodCreateDialog` with a month `<Select>`, date/name autocomplete, a cross-month soft warning, and a "Crear 12 meses" batch action — all contained in the single existing component. The existing REST endpoint `POST /api/organizations/[orgSlug]/periods` is called unchanged (12 times sequentially for batch). `MONTH_NAMES_ES` moves to a shared client-consumable module at `features/fiscal-periods/month-names.ts`. No backend changes.

---

## Architecture Decisions

| # | Question | Choice | Rejected | Rationale |
|---|----------|--------|----------|-----------|
| OQ-1 | Batch creation | 12 sequential `fetch` calls, client-side | Single Server Action + `$transaction` | Backend is pure REST (no Server Actions pattern anywhere in codebase). Adding one Server Action solely for batch breaks the architectural pattern. Sequential calls reuse existing permission/validation path, expose per-month error granularity, and the 12-request overhead is negligible (infrequent one-time operation). Partial failure (UX-T08) is handled by collecting results and surfacing summary toast. |
| OQ-2 | Idempotency | Skip-existing (409 → continue, not fail-fast) | Fail-fast; upsert | UX-T08 requires "report cuántos creados, cuántos ya existían". 409 from `FISCAL_PERIOD_MONTH_EXISTS` maps to "ya existía" — handler increments `skipped` counter, continues. Upsert would hide data integrity information. |
| OQ-3 | Warning trigger | `startDate.getMonth() !== endDate.getMonth()` OR `startDate.getDate() !== 1` OR `endDate` is not last day of its month | Spans > N days | Exact calendar-month alignment check is more precise than a day-count threshold and directly maps to what the service enforces via `getUTCMonth()+1`. Derived state — no extra storage. |
| OQ-4 | `MONTH_NAMES_ES` placement | New file `features/fiscal-periods/month-names.ts` (no `"server-only"` import) | `lib/i18n/months.ts`; inline duplicate | `features/fiscal-periods/` is the natural domain home. Removing `"server-only"` barrier allows client import. Service imports it too — no circular dependency since `fiscal-periods.service.ts` is already server-only and `month-names.ts` is isomorphic. `lib/i18n/` doesn't exist yet; creating it just for this would be premature. |

---

## Data Flow

```
User selects month + year
       │
       ▼
React state: selectedMonth (1..12), year
       │
       ├──→ autocomplete startDate = first day of month (local midnight → "YYYY-MM-DD")
       ├──→ autocomplete endDate   = last day of month  (local midnight → "YYYY-MM-DD")
       └──→ autocomplete name      = MONTH_NAMES_ES[month-1] + " " + year

User edits startDate/endDate manually → overrides autocomplete
       │
       ▼
Derived: crossMonthWarning = (startDate.getMonth() !== endDate.getMonth())
                           OR (startDate.getDate() !== 1)
                           OR (endDate !== lastDayOf endDate.month)
       │
       ▼  (single period)
handleSubmit → POST /api/.../periods  →  201 | 409 | 4xx

       │  (batch — "Crear 12 meses")
       ▼
handleBatch → for month 1..12:
                POST /api/.../periods { month-derived payload }
              collect { created, skipped, failed }
              toast summary
```

---

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `features/fiscal-periods/month-names.ts` | Create | Exports `MONTH_NAMES_ES` (no `"server-only"`); isomorphic |
| `features/fiscal-periods/fiscal-periods.service.ts` | Modify | Import `MONTH_NAMES_ES` from `./month-names` instead of local const |
| `features/fiscal-periods/index.ts` | Modify | Re-export `MONTH_NAMES_ES` from `month-names.ts` |
| `components/accounting/period-create-dialog.tsx` | Modify | Add month Select, autocomplete logic, cross-month warning, batch button |
| `components/accounting/__tests__/period-create-dialog.test.tsx` | Create | RTL tests UX-T01..UX-T08 (TDD — written RED before component changes) |

---

## Interfaces / Contracts

```typescript
// features/fiscal-periods/month-names.ts
export const MONTH_NAMES_ES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
] as const;
export type MonthNameEs = typeof MONTH_NAMES_ES[number];

// Batch result (internal to component — no new API type)
interface BatchResult {
  created: number;
  skipped: number;   // 409 FISCAL_PERIOD_MONTH_EXISTS
  failed:  number;   // other errors
  errors:  string[]; // error messages for failed months
}
```

State shape added to `PeriodCreateDialog`:

```typescript
const [selectedMonth, setSelectedMonth] = useState<number | null>(null); // 1..12
const [isBatching, setIsBatching] = useState(false);
```

Autocomplete triggers via `useEffect` watching `[selectedMonth, year]`:
- Sets `startDate`, `endDate`, `name` only if `selectedMonth !== null`
- Manual edits to date inputs update state directly — no re-watch needed

Cross-month warning: derived inline from `startDate` + `endDate` strings (parse to `Date` only when both present).

---

## Testing Strategy

Strict TDD: RED tests written FIRST in `components/accounting/__tests__/period-create-dialog.test.tsx` before any component code changes.

| Layer | What to Test | Approach |
|-------|-------------|----------|
| RTL Component | UX-T01: placeholder "Ej: Abril 2026" + microcopia present | `render` + `getByPlaceholderText` / `getByText` |
| RTL Component | UX-T02: month select autocompletes `startDate`/`endDate` | `userEvent.selectOptions` → `getByLabelText` value assertions |
| RTL Component | UX-T03: month select autocompletes `name` | same as T02, assert name input value |
| RTL Component | UX-T04: manual date edit wins over autocomplete | select month → `userEvent.type` on startDate → assert manual value kept |
| RTL Component | UX-T05: cross-month warning visible/hidden | set startDate="2026-04-01" endDate="2026-05-31" → warning visible; same month → hidden |
| RTL Component | UX-T06: warning does not disable submit | warning visible + fields filled → submit button not disabled |
| RTL Component | UX-T07: batch button fires 12 POST requests | `vi.spyOn(global, 'fetch')` → click "Crear 12 meses" → assert 12 calls |
| RTL Component | UX-T08: batch tolerates 409 per month | mock 3 responses as 409 `FISCAL_PERIOD_MONTH_EXISTS` → assert toast shows "9 creados, 3 ya existían" |
| Integration | Not required | Batch uses existing service path already covered by `fiscal-periods.service.multiplicity.test.ts` |

---

## Invariant Collision Check (Rule 7)

**`PERMISSIONS_WRITE["period"]`**: `["owner", "admin"]`. Batch creation calls the same `POST /api/organizations/[orgSlug]/periods` endpoint 12 times. Each call goes through `requirePermission("period", "write", orgSlug)` — same gate. No new permission surface. No collision.

**Prisma uniqueness**: `@@unique([organizationId, year, month])`. The unique index is `(orgId, year, month)` — NOT `(orgId, name)` and NOT `(orgId, startDate, endDate)`. This means:
- Two periods with the same name but different months are ALLOWED by the schema (name is not unique).
- Batch creation for 12 months of the same year is safe: each month is unique by `month` value.
- If a month already exists (re-run scenario), the service throws `ConflictError(FISCAL_PERIOD_MONTH_EXISTS)` — mapped correctly to 409 in the route handler.

**Feature flags**: None detected on the period creation dialog or the periods route.

### Invariant Collisions

None blocking. One notable discovery: `name` has no uniqueness constraint — two periods can share the same name. This does NOT affect this change (autocomplete produces distinct names per month-year pair), but is worth noting for future tooling.

---

## Migration / Rollout

No migration required. No schema changes. No data migration. The existing period API contract is unchanged — the component adds calls to the same endpoint.

---

## Open Questions

- None blocking design or implementation.
