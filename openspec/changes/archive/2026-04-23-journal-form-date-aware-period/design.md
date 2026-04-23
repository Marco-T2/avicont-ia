# Design: Journal Form — Date-Aware Period Auto-Selection

**Change**: `journal-form-date-aware-period`
**Date**: 2026-04-23

## Technical Approach

Add `periodManuallySelected` dirty-flag state + `useEffect([date, periods, periodManuallySelected])` to `journal-entry-form.tsx`. Extract the OPEN-period lookup into a pure helper `findPeriodCoveringDate` at `features/fiscal-periods/period-helpers.ts`. Render a warning banner (mirroring `period-create-dialog.tsx` pattern) when no period covers the current date.

The existing `canSubmit` guard (line 165) already requires `periodId` truthy — no change needed there. When no period matches, the effect sets `periodId = ""`, which makes `canSubmit` false automatically.

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|----------|--------|----------|-----------|
| Helper location | `features/fiscal-periods/period-helpers.ts` | `lib/date-utils.ts` | Feature-local; this helper is domain-specific to fiscal periods, not a generic date util |
| Date comparison | String-slice: `period.startDate.toISOString().slice(0,10) <= date` | `new Date(date)` construction | Bolivia is UTC-4; `new Date("2026-04-01")` parses as UTC midnight → 2026-03-31 20:00 local. String comparison avoids all TZ math |
| Dirty-flag init | `useState(false)` in both new and edit mode | `useState(!!editEntry?.periodId)` | Spec AC-3.2: edit mode date changes SHOULD re-select. Init as `false` lets the effect run on mount and date changes. Dirty-flag only flips on explicit user Select interaction |
| Warning placement | Below period `<Select>`, above description | Inline in Select | Matches `period-create-dialog.tsx` pattern; visible without scrolling |
| Warning style | Reuse `period-create-dialog.tsx` yellow banner classes | Toast / inline text | Consistent UX; `role="alert"` for accessibility; non-blocking |

## Data Flow

```
<Input type="date" onChange> ──→ setDate(string)
                                      │
                           useEffect([date, periods,
                           periodManuallySelected])
                                      │
                          !periodManuallySelected && date?
                            ├─ YES → findPeriodCoveringDate(date, periods)
                            │         ├─ found → setPeriodId(match.id)
                            │         └─ not found → setPeriodId("")
                            └─ NO  → skip (user override wins)

<Select onValueChange> ──→ setPeriodManuallySelected(true)
                       ──→ setPeriodId(value)

resetForm() ──→ setPeriodManuallySelected(false) + setPeriodId("")
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `features/fiscal-periods/period-helpers.ts` | Create | Pure helper `findPeriodCoveringDate(date, periods)` |
| `features/fiscal-periods/__tests__/period-helpers.test.ts` | Create | Unit tests (5 cases) for the helper |
| `features/fiscal-periods/index.ts` | Modify | Re-export `findPeriodCoveringDate` |
| `components/accounting/journal-entry-form.tsx` | Modify | Add dirty-flag state, useEffect, warning banner, wire Select onValueChange |
| `components/accounting/__tests__/journal-entry-form-date-period.test.tsx` | Create | RTL component tests JF-T01..JF-T09 |

## Interfaces / Contracts

```ts
// features/fiscal-periods/period-helpers.ts
import type { FiscalPeriod } from "@/generated/prisma/client";

/**
 * Returns the single OPEN period covering `date`, or null.
 * `date` is a "YYYY-MM-DD" string (from <input type="date">).
 * Comparison is done via ISO string slice to avoid UTC/TZ shift.
 */
export function findPeriodCoveringDate(
  date: string,
  periods: FiscalPeriod[],
): FiscalPeriod | null {
  return (
    periods.find(
      (p) =>
        p.status === "OPEN" &&
        p.startDate.toISOString().slice(0, 10) <= date &&
        date <= p.endDate.toISOString().slice(0, 10),
    ) ?? null
  );
}
```

```ts
// journal-entry-form.tsx — new state (add after existing useState declarations)
const [periodManuallySelected, setPeriodManuallySelected] = useState(false);

// useEffect — add after existing voucherType useEffect
useEffect(() => {
  if (periodManuallySelected || !date) return;
  const match = findPeriodCoveringDate(date, periods);
  setPeriodId(match?.id ?? "");
}, [date, periods, periodManuallySelected]);

// period Select onValueChange — replace bare setPeriodId
onValueChange={(value) => {
  setPeriodManuallySelected(true);
  setPeriodId(value);
}}
```

```tsx
// Warning banner — render between period Select and voucher type Select
{date && !periodId && periods.length > 0 && (
  <div
    role="alert"
    className="rounded-md border border-yellow-400 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-300"
  >
    No hay un período abierto que cubra esta fecha. Abrí el período
    correspondiente o elegí otra fecha.
  </div>
)}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `findPeriodCoveringDate` — 5 cases: inside range, startDate boundary, endDate boundary, OPEN match none, non-OPEN period ignored | Vitest, pure function — no DOM |
| Component | JF-T01..JF-T09 per spec | RTL, `userEvent`, fake timers where needed; follow `journal-entry-form-today-default.test.tsx` mock pattern |
| Regression | Existing tests continue green | `pnpm test` after each RED→GREEN cycle |

## OQ Resolutions

| OQ | Resolution |
|----|------------|
| OQ-1 (warning text) | "No hay un período abierto que cubra esta fecha. Abrí el período correspondiente o elegí otra fecha." |
| OQ-2 (warning timing) | On date change (pre-submit) — early feedback |
| OQ-3 (second form) | `create-journal-entry-form.tsx` OUT OF SCOPE — no `periods` prop |
| OQ-4 (edit mode date change) | Dirty-flag starts `false`; edit mode date changes re-select unless user manually touched period Select |

## Migration / Rollout

No migration required. Pure client-side change. Single-file + helper; rollback = revert `journal-entry-form.tsx` + delete `period-helpers.ts`.
