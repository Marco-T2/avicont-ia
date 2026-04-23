# Design: Fiscal Period Monthly Enforcement

## Technical Approach

Add a pure guard function `assertMonthlyShape(startDate, endDate)` that runs in `FiscalPeriodsService.create()` between the existing `INVALID_DATE_RANGE` check and the `findByYearAndMonth` DB round-trip. The guard uses a new `lastDayOfUTCMonth(date)` helper added to the existing `lib/date-utils.ts`. Error constant `FISCAL_PERIOD_NOT_MONTHLY` joins `features/shared/errors.ts` alongside its siblings.

## Architecture Decisions

| OQ | Option | Decision | Rationale |
|----|--------|----------|-----------|
| OQ-1: helper location | `month-helpers.ts` (new) vs `lib/date-utils.ts` (existing) vs inline | **`lib/date-utils.ts`** | File already exists with UTC-aware date helpers (`toNoonUtc`, `formatDateBO`). Tests exist at `lib/__tests__/date-utils.test.ts`. Adding here avoids a new file and keeps UTC math co-located. `month-names.ts` is domain display data, not the right analogy. |
| OQ-2: guard insertion point | Before `INVALID_DATE_RANGE` / after range / after DB call | **After `INVALID_DATE_RANGE`, before `findByYearAndMonth`** | Cheapest O(1) date math runs before DB round-trip. Range check goes first because malformed ranges may produce nonsensical `lastDayOfUTCMonth` inputs. |
| OQ-3: error constant location | `features/shared/errors.ts` vs feature-local | **`features/shared/errors.ts`** | `INVALID_DATE_RANGE` and `FISCAL_PERIOD_MONTH_EXISTS` are both defined there (lines 60, 59). New constant joins the "Períodos Fiscales" block. |
| OQ-4: apply to `update()` | Guard in update path | **N/A** | `FiscalPeriodsService` has no `update()` method (confirmed: 93 lines, `list`, `getById`, `create` only). |
| OQ-5: test file organization | Append to existing vs new file | **New `fiscal-periods.service.monthly-shape.test.ts`** + **`lib/__tests__/date-utils.test.ts`** additions | Consistent with `.multiplicity.test.ts` per-concern split. Helper tests co-locate with existing `date-utils` test suite. |

## Data Flow

```
create(orgId, input)
  │
  ├─ INVALID_DATE_RANGE check          ← existing (line 42)
  │    endDate <= startDate → 422
  │
  ├─ assertMonthlyShape(startDate, endDate)   ← NEW (service-private)
  │    startDate.getUTCDate() ≠ 1 → 422 FISCAL_PERIOD_NOT_MONTHLY
  │    endDate ≠ lastDayOfUTCMonth(startDate) → 422 FISCAL_PERIOD_NOT_MONTHLY
  │
  ├─ findByYearAndMonth (DB)           ← existing (line 54)
  │    duplicate → 409 FISCAL_PERIOD_MONTH_EXISTS
  │
  └─ repo.create (DB) + P2002 catch   ← existing (line 76)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `lib/date-utils.ts` | Modify | Add `lastDayOfUTCMonth(date: Date): Date` export |
| `lib/__tests__/date-utils.test.ts` | Modify | Add 5-scenario unit test block for `lastDayOfUTCMonth` |
| `features/shared/errors.ts` | Modify | Add `FISCAL_PERIOD_NOT_MONTHLY` constant (Períodos Fiscales block) |
| `features/fiscal-periods/fiscal-periods.service.ts` | Modify | Import `lastDayOfUTCMonth`, add `assertMonthlyShape`, call in `create()` |
| `features/fiscal-periods/__tests__/fiscal-periods.service.monthly-shape.test.ts` | Create | ME-T01..ME-T09 integration tests for the guard |

## Interfaces / Contracts

```typescript
// lib/date-utils.ts — new export
export function lastDayOfUTCMonth(date: Date): Date {
  // Date.UTC(year, month+1, 0) → day=0 wraps to last day of previous month
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

// features/shared/errors.ts — new constant (Períodos Fiscales block)
export const FISCAL_PERIOD_NOT_MONTHLY = "FISCAL_PERIOD_NOT_MONTHLY";

// features/fiscal-periods/fiscal-periods.service.ts — private guard
function assertMonthlyShape(startDate: Date, endDate: Date): void {
  const isFirstDay = startDate.getUTCDate() === 1;
  const isLastDay = endDate.getTime() === lastDayOfUTCMonth(startDate).getTime();
  if (!isFirstDay || !isLastDay) {
    throw new ValidationError(
      "El período debe corresponder a exactamente un mes calendario.",
      FISCAL_PERIOD_NOT_MONTHLY,
    );
  }
}
```

Edge cases verified for `lastDayOfUTCMonth`:
- Jan 2026 → Jan 31 (UTC month index 0, wraps correctly)
- Feb 2024 (leap) → Feb 29
- Feb 2026 (non-leap) → Feb 28
- Apr 2026 → Apr 30
- Dec 2026 → Dec 31 (month index 12 → Date.UTC wraps to Jan of next year, day 0 = Dec 31 of current year ✓)

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `lastDayOfUTCMonth` — 5 edge cases | Add block to `lib/__tests__/date-utils.test.ts`; no mocks needed |
| Service integration | Guard in `create()`: ME-T01..ME-T09 | `fiscal-periods.service.monthly-shape.test.ts`; mock repo like `.multiplicity.test.ts` |
| Regression | All existing `fiscal-periods.service.*.test.ts` suites | Existing fixtures use valid monthly dates — no breakage expected |

TDD order: RED (write test) → GREEN (implement guard) → refactor. Each ME-T case is its own `it()` block — no parametrization.

## Migration / Rollout

No migration required. No schema changes, no enum changes, no DB migration. Guard is pure service-layer logic.

## Rule 7 Collision Check

- `@@unique([organizationId, year, month])` — unchanged
- `month` derivation in `fiscal-periods.repository.ts:56` — unchanged (guard runs at service layer before repo)
- `PERMISSIONS_WRITE["period"]` — unchanged
- "Backend MUST NOT be modified" in `fiscal-period-creation-ux` spec — explicitly superseded by this change (as noted in proposal)

**Invariant collisions: none.**

## Open Questions

None. All OQ-1..OQ-5 resolved above.
