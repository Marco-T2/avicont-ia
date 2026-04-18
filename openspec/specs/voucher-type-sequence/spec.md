# Spec: voucher-type-sequence

**Change**: `voucher-types`
**Domain**: `voucher-type-sequence`

## Overview

Independent correlative numbering per `(organizationId, voucherTypeId, periodId)`. The existing `getNextNumber` in `journal.repository.ts` uses an unprotected `findFirst + orderBy desc` — susceptible to duplicate numbers under concurrent inserts. This domain hardens that function and specifies the display format driven by `VoucherTypeCfg.prefix`.

---

## REQ-B.1 — Siguiente número correlativo

`getNextNumber(organizationId, voucherTypeId, periodId)` returns `prevMax + 1` for the triple. Sequence resets to 1 for each new period.

| Scenario | ID | Description | Expected outcome |
|----------|----|-------------|-----------------|
| S1 | B.1-S1 | First entry in period | No prior entries for `(org, type, period)` → returns `1` |
| S2 | B.1-S2 | Third entry in period | Two entries already exist for `(org, type, period)` → returns `3` |
| S3 | B.1-S3 | Independent per voucher type | Type A has 5 entries in period P; type B has 0 → `getNextNumber(org, typeB, P)` returns `1` |
| S4 | B.1-S4 | Resets across periods | Type A has 10 entries in period P1; P2 has none → `getNextNumber(org, typeA, P2)` returns `1` |

**Test file**: `features/accounting/journal/__tests__/get-next-number.test.ts`

---

## REQ-B.2 — Resiliencia ante concurrencia

`getNextNumber` must produce unique numbers when called concurrently.

| Scenario | ID | Description | Expected outcome |
|----------|----|-------------|-----------------|
| S1 | B.2-S1 | N concurrent calls — all unique | N simultaneous calls for the same `(org, voucherType, period)` → each receives a distinct value; the resulting set equals `{1, 2, …, N}` with no duplicates and no gaps |
| S2 | B.2-S2 | Retry limit exhausted | After the configured maximum retry attempts (5) all fail due to contention → throws error with code `VOUCHER_NUMBER_CONTENTION` |

**Note (non-normative)**: the MECHANISM (optimistic retry on `@@unique([organizationId, voucherTypeId, periodId, number])` constraint violation) is in the design doc. This spec only asserts the observable outcome: N unique numbers or a `VOUCHER_NUMBER_CONTENTION` error.

**Test file**: `features/accounting/journal/__tests__/get-next-number-concurrency.test.ts`

---

## REQ-B.3 — Formato de display

`formatCorrelativeNumber` emits `{prefix}{YYMM}-{NNNNNN}`. The `prefix` is read from `VoucherTypeCfg.prefix`, not from a hardcoded map.

| Scenario | ID | Description | Expected outcome |
|----------|----|-------------|-----------------|
| S1 | B.3-S1 | Known type with DB prefix | `voucherType.prefix = "D"`, entry date in 2026-04, `number = 15` → `"D2604-000015"` |
| S2 | B.3-S2 | New type with custom prefix | `voucherType.prefix = "N"` (CN Nómina), first entry in 2026-04 → `"N2604-000001"` |
| S3 | B.3-S3 | Null/empty prefix | `voucherType.prefix` is `null` or `""` → returns `null` |

**Migration note**: `formatCorrelativeNumber(voucherTypeCode, date, number)` signature changes to `formatCorrelativeNumber(prefix, date, number)`. All callers must be updated. The `TYPE_PREFIX_MAP` in `correlative.utils.ts` is deleted.

**Test file**: `features/accounting/correlative.utils.test.ts` (extend existing file)

---

## Constraints

- The `@@unique([organizationId, voucherTypeId, periodId, number])` constraint already exists in the schema — it is the safety net for the optimistic retry strategy
- No gap-filling: if a journal entry is voided/deleted, its number is NOT reused
- `number` is immutable after creation (same as today)
- Display format date component uses `entryDate` field (as today), NOT the period's fiscal year boundaries
