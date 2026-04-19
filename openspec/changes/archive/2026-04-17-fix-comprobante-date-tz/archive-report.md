# Archive Report: fix-comprobante-date-tz

**Change**: `fix-comprobante-date-tz`
**Archived**: 2026-04-17
**Status**: CLOSED — PASS
**Verdict**: 13/13 REQs COMPLIANT, 899/899 tests, tsc clean

## Intent

User reported: "hoy 17/04 registré una venta pero cuando se guardó este tenía la fecha de 16/04". Off-by-one-day bug caused by UTC-midnight storage being rendered as prior day in Bolivia's UTC-4 timezone.

## Root Cause

Three code paths converged to create the bug:
1. **Form defaults**: `new Date().toISOString().split("T")[0]` → returns UTC day, wrong after 20:00 local
2. **Write layer**: raw `new Date(string)` parses "YYYY-MM-DD" as UTC midnight, stored wrong offset
3. **Display layer**: `new Date(ISO).toLocaleDateString("es-BO")` re-applies UTC-4 shift, showing prior day

## Fix Pattern

- **Form defaults**: `todayLocal()` — uses `getFullYear/Month/Date` local getters, returns "YYYY-MM-DD"
- **Write layer**: `toNoonUtc()` — slices "YYYY-MM-DD" + "T12:00:00.000Z", immune to ±12h shifts
- **Display layer**: `formatDateBO()` — slices ISO prefix and reformats as DD/MM/YYYY with NO Date parsing

## Scope Delivered

- 5 domains (sale, dispatch, purchase, payments, accounting)
- 13 requirements (REQ-A.1 through REQ-E.1), 32 scenarios
- All compliant, zero regressions
- 11 source files updated across form defaults, display layer, and repository write paths
- 4 server repositories with noon-UTC normalization
- 15 new tests in fix-batch (C-1, W-1, W-2) + full PR0-PR4 coverage
- Final: 899/899 tests, tsc clean

## Commits (canonical)

1. `15e217c` — chore(vitest): TZ=America/La_Paz env (PR0)
2. `1e9067c` — feat(lib): date-utils helpers todayLocal, formatDateBO, toNoonUtc (PR1)
3. `d566a9f` — fix(repos): noon-UTC normalization for sale/purchase/dispatch/iva-books (PR2)
4. `471a3e9` — fix(sale-form): use todayLocal() for new-record default (PR3)
5. `6b1fbea` — fix(dispatch-form): use todayLocal() for new-record default (PR3)
6. `2219916` — fix(purchase-form): use todayLocal() for new-record default (PR3)
7. `a9b4aba` — fix(display): swap toLocaleDateString to formatDateBO across comprobante views (PR4)
8. `0111da1` — chore(sdd): mark PR3+PR4 tasks complete
9. `92fdeee` — fix(forms): use todayLocal() in payments, lots, expenses, mortality (fix-batch C-1)
10. `4cc4869` — fix(purchases): use todayLocal() in emptyFleteeLine (fix-batch W-1)
11. `cfffd76` — fix(accounting): use todayLocal() in journal-entry forms (fix-batch W-2)
12. `a5c56e6` — chore(openspec): document fix-batch in tasks.md

## Files Modified

**Core utility**:
- `lib/date-utils.ts` + `lib/__tests__/date-utils.test.ts` (new helpers + coverage)

**Configuration**:
- `vitest.config.ts` (TZ=America/La_Paz)

**Server repositories** (noon-UTC normalization):
- `features/sale/(*.repository.ts)`, `features/purchase/(*.repository.ts)`, `features/dispatch/(*.repository.ts)`, `features/accounting/iva-books/(*.repository.ts)`

**Comprobante forms** (form defaults + display):
- `components/sales/sale-form.tsx`, `components/sales/sale-list.tsx`
- `components/dispatches/dispatch-form.tsx`, `components/dispatches/dispatch-list.tsx`
- `components/purchases/purchase-form.tsx`, `components/purchases/purchase-list.tsx`

**Ancillary forms** (form defaults fix-batch):
- `components/payments/payment-form.tsx`
- `components/lots/create-lot-dialog.tsx`
- `components/expenses/create-expense-form.tsx`
- `components/mortality/log-mortality-form.tsx`
- `components/accounting/journal-entry-form.tsx`, `components/accounting/create-journal-entry-form.tsx`

**Spec trail**:
- `openspec/changes/fix-comprobante-date-tz/` (full artifact trail)

## Out of Scope (by design D.5 REVISION)

Accounting list/report files (`journal-entry-list.tsx`, `ledger.tsx`, `period.tsx`, `receivable/payable/*`, `income-statement.tsx`, `balance-sheet.tsx`) still use `toLocaleDateString`. These are read-only aggregate views with lower display priority and different code path. Explicit deferral per design review D.5, not a gap.

## Follow-ups

None blocking. Suggested future cleanup: sweep the accounting list views in a separate change if timezone display becomes an issue there too.

## Summary

The off-by-one comprobante date bug (UTC vs UTC-4) is now fixed across all primary user-facing forms and data paths. Form defaults use local time, storage uses noon-UTC normalization, and display uses string-only formatting with no Date parsing. All 13 requirements met, 899 tests pass, zero regressions.
