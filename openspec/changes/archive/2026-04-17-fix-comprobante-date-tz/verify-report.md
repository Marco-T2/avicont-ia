# Verify Report: fix-comprobante-date-tz

**Date**: 2026-04-17  
**Verdict**: PASS  
**Tests**: 899/899 green (96 test files)  
**TSC**: clean

---

## Executive Summary

All requirements are now fully compliant. The fix batch (commits 92fdeee, 4cc4869, cfffd76) resolved all three issues found in the prior PASS-with-warnings verdict: C-1 (11 remaining `new Date().toISOString().split("T")[0]` references across 4 in-scope forms), W-1 (`emptyFleteeLine()` returning `fecha: ""`), and W-2/W-3 (journal-entry forms using the old UTC pattern). Zero remaining non-compliant references in `components/**/*.tsx` outside of edit-reuse branches (which are correct per design D.5). Five new test files were added for the fix batch, all using `vi.useFakeTimers` + `setSystemTime` with UTC-midnight crossing and asserting the correct LOCAL date.

---

## Fix Batch Outcome

| Issue | Status | Resolution | Commits |
|-------|--------|------------|---------|
| C-1 | **CLOSED** | `payment-form.tsx`, `create-lot-dialog.tsx`, `create-expense-form.tsx`, `log-mortality-form.tsx` — all `new Date().toISOString().split("T")[0]` replaced with `todayLocal()` | `92fdeee` |
| W-1 | **CLOSED** | `emptyFleteeLine()` in `purchase-form.tsx:161` now returns `fecha: todayLocal()` | `4cc4869` |
| W-2 | **CLOSED** | `journal-entry-form.tsx:83` and `create-journal-entry-form.tsx:60` now use `todayLocal()` | `cfffd76` |

New test files added by fix batch:
- `components/payments/__tests__/payment-form-today-default.test.tsx`
- `components/lots/__tests__/create-lot-dialog-today-default.test.tsx`
- `components/expenses/__tests__/create-expense-form-today-default.test.tsx`
- `components/mortality/__tests__/log-mortality-form-today-default.test.tsx`
- `components/accounting/__tests__/journal-entry-form-today-default.test.tsx`

All 5 use `vi.useFakeTimers` + `vi.setSystemTime(new Date("2026-04-18T01:00:00.000Z"))` (UTC midnight-crossing) and assert `value === "2026-04-17"` (local Bolivia date).

---

## Compliance Matrix

| REQ   | Scenario | Status | Evidence |
|-------|----------|--------|----------|
| A.1   | todayLocal() returns local calendar day | COMPLIANT | `lib/date-utils.ts:29-35` — `lib/__tests__/date-utils.test.ts:32-36` |
| A.1   | Zero-padded output | COMPLIANT | `lib/date-utils.ts:31-33` — `date-utils.test.ts:48-51` |
| A.1   | TZ env set in vitest | COMPLIANT | `vitest.config.ts:22,38` — `env: { TZ: "America/La_Paz" }` both projects |
| A.2   | formatDateBO UTC-midnight string | COMPLIANT | `lib/date-utils.ts:58-86` — `date-utils.test.ts:61-63` |
| A.2   | formatDateBO Date instance | COMPLIANT | `lib/date-utils.ts:63-66` — `date-utils.test.ts:70-72` |
| A.2   | Never calls toLocaleDateString | COMPLIANT | `lib/date-utils.ts:58-86` — no `toLocaleDateString` in file |
| A.3   | null/undefined → "" | COMPLIANT | `lib/date-utils.ts:59` — `date-utils.test.ts:84-95` |
| A.3   | NaN Date → "" | COMPLIANT | `lib/date-utils.ts:65` — `date-utils.test.ts:103-106` |
| A.3   | Short string → "" | COMPLIANT | `lib/date-utils.ts:68` — `date-utils.test.ts:96-98` |
| B.1   | sale-form new record uses todayLocal() | COMPLIANT | `sale-form.tsx:156-157` — `sale-form-today-default.test.tsx` |
| B.2   | sale-form read-only Fecha via formatDateBO | COMPLIANT | `sale-form.tsx:546` — `sale-form-display-date.test.tsx` |
| B.2   | sale-form cobro payment.date via formatDateBO | COMPLIANT | `sale-form.tsx:889` — `sale-form-display-date.test.tsx` |
| B.3   | sale-list date via formatDateBO | COMPLIANT | `sale-list.tsx:250` — `sale-list-date-format.test.tsx` |
| B.4   | sale.repository create → noon UTC | COMPLIANT | `sale.repository.ts:157` — `sale-repo-noon-utc.test.ts:86-94` |
| B.4   | sale.repository update → noon UTC | COMPLIANT | `sale.repository.ts:308` — `sale-repo-noon-utc.test.ts:116-138` |
| C.1   | dispatch-form new record uses todayLocal() | COMPLIANT | `dispatch-form.tsx:291-292` — `dispatch-form-today-default.test.tsx` |
| C.2   | dispatch-form read-only Fecha via formatDateBO | COMPLIANT | `dispatch-form.tsx:795` — `dispatch-form-display-date.test.tsx` |
| C.2   | dispatch-form cobro payment.date via formatDateBO | COMPLIANT | `dispatch-form.tsx:1445` — `dispatch-form-display-date.test.tsx` |
| C.2   | dispatch-list date via formatDateBO | COMPLIANT | `dispatch-list.tsx:168` — `dispatch-list-date-format.test.tsx` |
| D.1   | purchase-form main date uses todayLocal() | COMPLIANT | `purchase-form.tsx:215-216` — `purchase-form-today-default.test.tsx` |
| D.1   | FLETE emptyFleteeLine fecha uses todayLocal() | **COMPLIANT** | `purchase-form.tsx:161` — `purchase-form-today-default.test.tsx` (W-1 CLOSED via `4cc4869`) |
| D.2   | purchase-form read-only Fecha via formatDateBO | COMPLIANT | `purchase-form.tsx:685` — `purchase-form-display-date.test.tsx` |
| D.2   | purchase-form pago payment.date via formatDateBO | COMPLIANT | `purchase-form.tsx:1466` — `purchase-form-display-date.test.tsx` |
| D.2   | purchase-list date via formatDateBO | COMPLIANT | `purchase-list.tsx:330` — `purchase-list-date-format.test.tsx` |
| D.3   | purchase.repository create → noon UTC | COMPLIANT | `purchase.repository.ts:187` — `purchase-repo-noon-utc.test.ts:95-103` |
| D.3   | purchase.repository update → noon UTC | COMPLIANT | `purchase.repository.ts:462` — `purchase-repo-noon-utc.test.ts:124-146` |
| E.1   | iva-books createPurchase → noon UTC | COMPLIANT | `iva-books.repository.ts:190` — `iva-books-repo-noon-utc.test.ts:193-201` |
| E.1   | iva-books updatePurchase → noon UTC | COMPLIANT | `iva-books.repository.ts:259` — `iva-books-repo-noon-utc.test.ts:214-224` |
| E.1   | iva-books createSale → noon UTC | COMPLIANT | `iva-books.repository.ts:318` — `iva-books-repo-noon-utc.test.ts:227-235` |
| E.1   | iva-books updateSale → noon UTC | COMPLIANT | `iva-books.repository.ts:379` — `iva-books-repo-noon-utc.test.ts:248-258` |
| E.1   | dispatch.repository create → noon UTC | COMPLIANT | `dispatch.repository.ts:149` — `dispatch-repo-noon-utc.test.ts:110-119` |
| E.1   | dispatch.repository update → noon UTC | COMPLIANT | `dispatch.repository.ts:230` — `dispatch-repo-noon-utc.test.ts:121-142` |

### Additional call sites (spec "Files Modified" / success criteria)

| File | Spec Requirement | Status |
|------|-----------------|--------|
| `components/payments/payment-form.tsx` | Replace `new Date().toISOString().split("T")[0]` with `todayLocal()` | **COMPLIANT** (commit `92fdeee`) |
| `components/lots/create-lot-dialog.tsx` | Replace with `todayLocal()` | **COMPLIANT** (commit `92fdeee`) |
| `components/expenses/create-expense-form.tsx` | Replace with `todayLocal()` | **COMPLIANT** (commit `92fdeee`) |
| `components/mortality/log-mortality-form.tsx` | Replace with `todayLocal()` | **COMPLIANT** (commit `92fdeee`) |
| `components/accounting/journal-entry-form.tsx` | Replace with `todayLocal()` (design D.5) | **COMPLIANT** (commit `cfffd76`) |
| `components/accounting/create-journal-entry-form.tsx` | Replace with `todayLocal()` (design D.5) | **COMPLIANT** (commit `cfffd76`) |

---

## Issues

### CRITICAL — All CLOSED

~~**C-1**~~: CLOSED via commit `92fdeee`. Zero `new Date().toISOString().split("T")[0]` references remain in `components/**/*.tsx` outside of edit-reuse branches (which are correct per design D.5).

### WARNINGS — All CLOSED

~~**W-1**~~: CLOSED via commit `4cc4869`. `emptyFleteeLine()` in `purchase-form.tsx:161` now returns `fecha: todayLocal()`.

~~**W-2**~~: CLOSED via commit `cfffd76`. `journal-entry-form.tsx:83` and `create-journal-entry-form.tsx:60` now use `todayLocal()`.

### SUGGESTIONS (retained, non-blocking)

**S-1**: `toNoonUtc` accepts `string | Date` (implementation is a superset of spec). Safe and tested.

**S-2**: `iva-books.repository.ts` lines 259 and 379 use conditional `toNoonUtc`. Pattern is sound.

---

## Global Sweep Results

### `new Date().toISOString().split("T")[0]` in `components/**/*.tsx` (non-test)

**Zero hits** on new-record default patterns. Remaining occurrences are edit-reuse branches only (loading existing records from DB) — correct per design D.5:

| File | Lines | Status |
|------|-------|--------|
| `components/sales/sale-form.tsx` | 1078-1079, 1086 | edit-reuse branches — correct per design D.5 |
| `components/purchases/purchase-form.tsx` | 242, 1626-1627, 1638 | edit-reuse branches — correct per design D.5 |
| `components/dispatches/dispatch-form.tsx` | remaining after 291 | edit-reuse branches — correct per design D.5 |

### `toLocaleDateString` in `components/sales/**`, `components/dispatches/**`, `components/purchases/**`

Zero remaining. All three domains clean.

---

## Test Suite

- **Total**: 899/899 passed, 96 test files
- **New test files (original batch)**: `lib/__tests__/date-utils.test.ts`, `features/sale/__tests__/sale-repo-noon-utc.test.ts`, `features/purchase/__tests__/purchase-repo-noon-utc.test.ts`, `features/accounting/iva-books/__tests__/iva-books-repo-noon-utc.test.ts`, `features/dispatch/__tests__/dispatch-repo-noon-utc.test.ts`, `components/sales/__tests__/sale-form-today-default.test.tsx`, `components/sales/__tests__/sale-list-date-format.test.tsx`, `components/sales/__tests__/sale-form-display-date.test.tsx`, `components/dispatches/__tests__/dispatch-form-today-default.test.tsx`, `components/dispatches/__tests__/dispatch-list-date-format.test.tsx`, `components/dispatches/__tests__/dispatch-form-display-date.test.tsx`, `components/purchases/__tests__/purchase-form-today-default.test.tsx`, `components/purchases/__tests__/purchase-list-date-format.test.tsx`, `components/purchases/__tests__/purchase-form-display-date.test.tsx`
- **New test files (fix batch)**: `components/payments/__tests__/payment-form-today-default.test.tsx`, `components/lots/__tests__/create-lot-dialog-today-default.test.tsx`, `components/expenses/__tests__/create-expense-form-today-default.test.tsx`, `components/mortality/__tests__/log-mortality-form-today-default.test.tsx`, `components/accounting/__tests__/journal-entry-form-today-default.test.tsx`

---

## TypeScript

`pnpm tsc --noEmit` — **clean** (no output)

---

## Verdict

**PASS** — All requirements fully compliant. C-1, W-1, W-2 closed. Zero remaining new-record date defaults using UTC-based pattern. 899/899 tests green. TSC clean. Ready to archive.
