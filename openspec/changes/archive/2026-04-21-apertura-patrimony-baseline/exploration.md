# Exploration: apertura-patrimony-baseline

**Change**: apertura-patrimony-baseline
**Date**: 2026-04-21
**Status**: Complete — Ready for Proposal

---

## Current State

### How SALDO_INICIAL is computed today

`EquityStatementService.generate()` calls:

```
initialBalances = repo.getPatrimonioBalancesAt(orgId, dayBefore)
  where dayBefore = dateFrom - 1 day
```

`getPatrimonioBalancesAt(orgId, cutoff)` issues a raw SQL query:

```sql
WHERE je.status = 'POSTED'
  AND je.date <= cutoff          -- all history up to cutoff (no dateFrom)
  AND a.type = 'PATRIMONIO'
```

Returns `Map<accountId, signedDecimal>`. The builder's `aggregateByColumn()` then turns this into per-column sums for the `SALDO_INICIAL` row.

**The bug**: For a company constituted in April 2026 with `dateFrom = 2026-04-01`:
- `dayBefore = 2026-03-31` — before the CA entry dated `2026-04-20`.
- `getPatrimonioBalancesAt(orgId, 2026-03-31)` returns an **empty map** — no prior history exists.
- `SALDO_INICIAL` = 0 for all columns (correct conceptually — it's a new company).
- `finalBalances = getPatrimonioBalancesAt(orgId, 2026-12-31)` — includes the CA entry's patrimony lines (200.000 Bs).
- `typedMovements = getTypedPatrimonyMovements(orgId, 2026-04-01, 2026-12-31)` — CA has code `CA`, NOT in the whitelist `['CP','CL','CV']` → **zero typed movements**.
- Invariant check: `finalByColumn[CAPITAL_SOCIAL] = 200000` vs `initial(0) + typed(0) + resultado(0)` → `imbalanceDelta = 200000` → `imbalanced = true`.

The CA entry is picked up by `getPatrimonioBalancesAt` (it sees it in `finalBalances`) but NOT explained by any typed row or periodResult — hence the false imbalance.

### How typed movements are merged

`getTypedPatrimonyMovements` filters `vt.code IN ('CP','CL','CV')` over `[dateFrom, dateTo]`. For each code, it builds a `Map<accountId, signedDecimal>`. The builder iterates this to emit conditional rows and accumulate `typedByColumnTotal`. The invariant is:

```
finalByColumn[col] ≈ initialByColumn[col] + typedByColumnTotal[col] + resultByColumn[col]
```

CA entries are invisible to this pipeline — they contaminate `finalByColumn` without being accounted for anywhere.

---

## Affected Areas

| Path | Reason |
|------|--------|
| `features/accounting/equity-statement/equity-statement.repository.ts` | Needs new method `getAperturaPatrimonyDelta(orgId, dateTo)` |
| `features/accounting/equity-statement/equity-statement.builder.ts` | Needs `aperturaBaseline` input merged into `initialByColumn` BEFORE invariant check |
| `features/accounting/equity-statement/equity-statement.types.ts` | Needs `aperturaBaseline?: Map<string, Decimal>` added to `BuildEquityStatementInput` |
| `features/accounting/equity-statement/equity-statement.service.ts` | Needs one additional repo call wired into `Promise.all` and passed to builder |
| `features/accounting/equity-statement/__tests__/equity-statement.builder.test.ts` | New fixture: CA delta merges into SALDO_INICIAL; imbalanced=false |
| `features/accounting/equity-statement/__tests__/equity-statement.repository.test.ts` | New fixture: CA POSTED entry with patrimony lines, verify delta returned correctly |
| `features/accounting/equity-statement/__tests__/equity-statement.service.test.ts` | Mock `getAperturaPatrimonyDelta`; verify it is called with correct args |
| `features/accounting/equity-statement/__tests__/equity-statement.integration.test.ts` | New describe block: CA-only org, no prior period, verifies imbalanced=false |

**No changes needed**:
- `prisma/seeds/voucher-types.ts` — CA already seeded (line 19, code `CA`, prefix `A`, isAdjustment: false).
- `prisma/schema.prisma` — no schema changes. `JournalEntry.voucherType` → `VoucherTypeCfg.code` join is already used in the typed movements query; same join is reusable for CA.
- `equity-statement.types.ts` (RowKey / ColumnKey) — no new row or column needed; CA merges silently into SALDO_INICIAL.

---

## Approaches

### Option A — Dedicated `getAperturaPatrimonyDelta(orgId, dateTo)` method (RECOMMENDED)

Add a new repository method that queries ONLY CA-voucher POSTED entries with `je.date <= dateTo` and `a.type = PATRIMONIO`. Returns `Map<accountId, signedDecimal>` (same shape as `getPatrimonioBalancesAt`).

In `BuildEquityStatementInput`, add optional `aperturaBaseline?: Map<string, Decimal>`. The builder merges it into `initialByColumn` before the invariant check:

```ts
// After computing initialByColumn from initialBalances:
if (aperturaBaseline) {
  for (const acc of accounts) {
    const delta = aperturaBaseline.get(acc.id);
    if (delta && !delta.isZero()) {
      const col = accountColumn.get(acc.id)!;
      initialByColumn[col] = initialByColumn[col].plus(delta);
    }
  }
}
```

Service adds one more `Promise.all` slot:

```ts
aperturaBaseline = repo.getAperturaPatrimonyDelta(orgId, input.dateTo)
```

**Pros**:
- Single-responsibility: the new method has one clear job (CA = opening state aggregator).
- No contamination of `getPatrimonioBalancesAt` — existing tests unchanged.
- `getPatrimonioBalancesAt(dayBefore)` naturally returns empty for first-period companies — the CA delta supplements it cleanly.
- The builder invariant does not need to change structurally; CA becomes part of initial state, not a movement.
- TDD: easy to unit-test in isolation (pure SQL aggregation with known inputs).
- Optional field in `BuildEquityStatementInput` means zero breaking changes to existing builder tests.

**Cons**:
- One extra DB call per statement generation (negligible — parallel in `Promise.all`).
- Slight duplication of SQL shape with `getPatrimonioBalancesAt`.

**Effort**: Low. ~30 lines new production code + ~40 lines new test fixtures.

---

### Option B — Extend `getPatrimonioBalancesAt` with a `voucherCodeExclusions` parameter

Modify `getPatrimonioBalancesAt` to accept an optional set of voucher codes to exclude (e.g., exclude `CA` from the normal balance query, and separately call it for `CA` only). Alternatively, add an overload that computes the CA delta as a side-channel.

**Pros**:
- No new method surface.

**Cons**:
- `getPatrimonioBalancesAt` today does NOT filter by voucher code at all — CA entries are correctly included when `cutoff >= je.date`. The problem is not that CA pollutes `getPatrimonioBalancesAt`; it IS the correct accumulation. The issue is only at `getTypedPatrimonyMovements` level.
- Modifying the existing method's SQL risks breaking `SALDO_INICIAL` computation for normal subsequent periods (where the CA should already be reflected in `initialBalances`).
- Adds accidental complexity — the method becomes multi-purpose.

**Effort**: Medium, higher risk. Breaks existing repo tests.

---

### Option C — Handle CA inside `getTypedPatrimonyMovements` as a special branch

Extend the typed movements query to include `CA` with a special `WHERE je.date <= dateTo` (instead of the normal `>= dateFrom AND <= dateTo`). Return it in a dedicated key like `"CA"` in the movements map. Builder checks for this key and merges it into `initialByColumn`.

**Pros**:
- One query instead of two for typed+apertura data.

**Cons**:
- `TypedPatrimonyMovements` is `Map<PatrimonyVoucherCode, ...>` and `PatrimonyVoucherCode = "CP"|"CL"|"CV"`. Adding `"CA"` requires widening the type and every consumer that pattern-matches on it.
- `getTypedPatrimonyMovements` currently applies a uniform `[dateFrom, dateTo]` range. CA needs `date <= dateTo` (no lower bound). Embedding this asymmetry inside the same query creates a confusing method contract.
- The builder would need to treat `"CA"` as a non-row code — special-casing inside the typed-row loop or a separate branch, which is exactly what Option A solves more cleanly.
- Would contaminate `TYPED_ROW_CONFIG` (no CA config entry) or require a guard — awkward.

**Effort**: Medium. Type changes cascade.

---

## Recommendation

**Option A — dedicated `getAperturaPatrimonyDelta` method**.

Rationale:

1. **Conceptual clarity**: The CA entry is STATE (opening baseline), not a MOVEMENT. A dedicated method with that name makes the intent unambiguous in code and in tests.
2. **Zero breaking changes**: `aperturaBaseline` is optional in `BuildEquityStatementInput`; all 34 existing builder tests pass unchanged. The existing 7-query `Promise.all` in the service gains one slot.
3. **Invariant safety**: The CA delta merges into `initialByColumn` — the same place where `getPatrimonioBalancesAt(dayBefore)` normally produces the opening state. For second and subsequent periods, `dayBefore` already includes any prior CA entries via `getPatrimonioBalancesAt`, so the new method would return ZERO (CA entries for those periods are in the past — already baked in). The merge is additive and idempotent for normal cases.
4. **TDD compliance**: New method = new focused test in `equity-statement.repository.test.ts` (CA fixture, POSTED filter, date filter, org scoping). New builder test: CA delta supplied → SALDO_INICIAL absorbs it → imbalanced=false. New service test: mock `getAperturaPatrimonyDelta` returns the expected map, verify it flows through. Integration test: CA-only new company, no prior period, confirms the full stack produces `imbalanced=false`.

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Double-counting CA in subsequent periods | Medium | `getAperturaPatrimonyDelta` uses `je.date <= dateTo`; for period 2027, if CA was dated 2026-04-20, it will also be in `getPatrimonioBalancesAt(2026-12-31)` = dayBefore for 2027. The merge would double-count. **Must restrict query**: only CA entries with `je.date >= dateFrom AND je.date <= dateTo` OR add a guard in builder: "only apply apertura delta if `initialBalances` is empty". The safest fix: `getAperturaPatrimonyDelta` should also accept `dateFrom` and filter `je.date >= dateFrom AND je.date <= dateTo` so it only picks up CA entries WITHIN the queried period. For first-period companies, `dateFrom` is the company's first date, so the CA entry (dated the same period) is captured. For subsequent periods, the CA from a prior period falls outside `[dateFrom, dateTo]` → returns empty map → zero delta → no double-count. |
| CA touching non-PATRIMONIO accounts | Low | The query already filters `a.type = 'PATRIMONIO'` — same as `getPatrimonioBalancesAt`. Non-patrimony sides of the CA entry are ignored automatically. |
| Multiple CA entries in the same period | Low | The SQL aggregates with `SUM` — multiple CA entries accumulate correctly. |
| Existing integration tests break | Low | No existing test fixture uses CA voucher type on patrimony accounts. New fixtures are additive. |

**Critical design note from risk 1**: `getAperturaPatrimonyDelta(orgId, dateFrom, dateTo)` — NOT just `(orgId, dateTo)`. The range constraint prevents double-counting in subsequent periods. This is the key architectural decision for this change.

---

## Ready for Proposal

**Yes.**

The approach is well-defined, low-risk, and respects all constraints:
- CA = state merged into SALDO_INICIAL (not a row, not a movement).
- No fake prior period.
- No F-605 contamination.
- No imbalance trigger for CA entries.
- Strict TDD: every new production path gets a focused test before implementation.

---

## skill_resolution

`none` — orchestrator did not inject compact project rules for this launch; no skill registry was available.
