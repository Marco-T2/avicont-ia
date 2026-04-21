# Design: apertura-patrimony-baseline

**Change**: apertura-patrimony-baseline
**Date**: 2026-04-21
**Status**: Draft

---

## Technical Approach

CA (Comprobante de Apertura) is STATE, not MOVEMENT. A new repo method aggregates CA deltas over PATRIMONIO accounts within `[dateFrom, dateTo]` and exposes them via an optional `aperturaBaseline` field in `BuildEquityStatementInput`. The builder merges the delta into `initialByColumn` BEFORE the invariant check, so `SALDO_INICIAL` absorbs the opening baseline silently. No new row, no new column, no F-605 contamination.

---

## Architecture Decisions

### 1. Merge point: `initialByColumn`, pre-invariant

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Merge into `initialByColumn` BEFORE invariant | Opening baseline feeds `initial[col] + typed[col] + resultado[col] = final[col]` correctly | **CHOSEN** |
| Merge AFTER invariant (cosmetic only) | Invariant would still flag `imbalanced = true` — defeats the purpose | Rejected |
| Emit CA as a new typed row | Contaminates F-605 (CA ∉ `{CP,CL,CV}`), widens `RowKey`, breaks 34 builder tests | Rejected |

**Rationale**: The bug IS the invariant firing — fixing it cosmetically misses the root cause. CA is part of opening state by accounting semantics (constitution entry), so it belongs in `SALDO_INICIAL`.

### 2. Date-range guard: `[dateFrom, dateTo]` inclusive

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `je.date BETWEEN dateFrom AND dateTo` | Period N+1 excludes CA from period N (already baked into `getPatrimonioBalancesAt(dayBefore)`) — no double-count | **CHOSEN** |
| `je.date <= dateTo` only | Double-counts CA in every subsequent period (CA appears in both `initialBalances` AND `aperturaBaseline`) | Rejected |
| Builder guard: "only apply if `initialBalances` empty" | Heuristic — fragile for mid-year edits or partial reconstructions | Rejected |

**Rationale**: The guard is the single architectural invariant protecting backwards compatibility for clients with CA history.

### 3. Optional field on `BuildEquityStatementInput`

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `aperturaBaseline?: Map<string, Decimal>` | 34 existing builder tests pass unchanged; opt-in at call site | **CHOSEN** |
| Required field | Breaks every caller + every existing fixture | Rejected |
| New builder function | Duplication; two invariant implementations to keep in sync | Rejected |

### 4. Dedicated repo method vs reusing existing

| Option | Tradeoff | Decision |
|--------|----------|----------|
| New `getAperturaPatrimonyDelta(orgId, dateFrom, dateTo)` | Single-responsibility; CA ≡ opening state aggregator; zero risk to existing 2 methods | **CHOSEN** |
| B — Extend `getPatrimonioBalancesAt` with `voucherCodeExclusions` | Multi-purpose method; no current CA filter exists, so adding exclusions breaks the "include everything up to cutoff" contract used by `dayBefore` calls | Rejected |
| C — Fold CA into `getTypedPatrimonyMovements` | Requires widening `PatrimonyVoucherCode` to `"CA"`; breaks exhaustive `TYPED_ROW_CONFIG` pattern; asymmetric date filtering inside one query | Rejected |

### 5. Signed-net semantics

Mirror `getPatrimonioBalancesAt` exactly:
- `DEUDORA`: `debit − credit`
- `ACREEDORA`: `credit − debit` (patrimony accounts are ACREEDORA → positive CA = capital contribution)

**Rationale**: One convention for all PATRIMONIO aggregations avoids sign confusion at the merge point.

---

## Data Flow

```
 Service.generate(orgId, role, {dateFrom, dateTo})
   │
   ├─► Promise.all (8 slots, +1 vs today)
   │     ├─ getPatrimonioBalancesAt(orgId, dayBefore)   → initialBalances
   │     ├─ getPatrimonioBalancesAt(orgId, dateTo)      → finalBalances
   │     ├─ findPatrimonioAccounts(orgId)               → accounts
   │     ├─ fsRepo.findAccountsWithSubtype(orgId)       → fsAccounts
   │     ├─ fsRepo.aggregateJournalLinesInRange(...)    → incomeMovements
   │     ├─ isClosedPeriodMatch(orgId, dF, dT)          → isClosedMatch
   │     ├─ getTypedPatrimonyMovements(orgId, dF, dT)   → typedMovements
   │     └─ getAperturaPatrimonyDelta(orgId, dF, dT)    → aperturaBaseline  ◄─ NEW
   │
   ├─► buildIncomeStatement(...) → periodResult
   │
   └─► buildEquityStatement({
         initialBalances, finalBalances, accounts,
         typedMovements, periodResult,
         aperturaBaseline,                              ◄─ NEW (optional)
         dateFrom, dateTo, preliminary,
       })
         │
         ├─ initialByColumn = aggregateByColumn(initialBalances, accounts)
         ├─ IF aperturaBaseline: merge into initialByColumn   ◄─ NEW (pre-invariant)
         ├─ finalByColumn   = aggregateByColumn(finalBalances, accounts)
         ├─ typed rows emit + typedByColumnTotal
         ├─ resultByColumn  (periodResult → RESULTADOS_ACUMULADOS)
         ├─ preliminary projection (unchanged)
         ├─ invariant: final ≈ initial(+CA) + typed + resultado   ◄─ now cierra
         └─ return EquityStatement  →  service injects orgId  →  serialize
```

---

## File Changes

| Path | Action | Description |
|------|--------|-------------|
| `features/accounting/equity-statement/equity-statement.repository.ts` | Modify | Add `getAperturaPatrimonyDelta(orgId, dateFrom, dateTo)` — raw SQL aggregate of POSTED JournalLines joined to `VoucherTypeCfg` on `code='CA'`, filtered by `[dateFrom, dateTo]` and `a.type='PATRIMONIO'`. Signed-net per `nature`. Zero-deltas omitted. |
| `features/accounting/equity-statement/equity-statement.types.ts` | Modify | Add optional `aperturaBaseline?: Map<string, Decimal>` to `BuildEquityStatementInput`. |
| `features/accounting/equity-statement/equity-statement.builder.ts` | Modify | After computing `initialByColumn`, if `aperturaBaseline` present, add each `accountId → delta` into its mapped column (via existing `accountColumn` lookup). Runs BEFORE invariant check. |
| `features/accounting/equity-statement/equity-statement.service.ts` | Modify | Add 8th slot to `Promise.all`; pass `aperturaBaseline` to builder. |
| `features/accounting/equity-statement/__tests__/equity-statement.repository.test.ts` | Modify | Add fixture: CA POSTED inside range → delta; CA outside range → empty; CA on non-PATRIMONIO → ignored; org-scoped. |
| `features/accounting/equity-statement/__tests__/equity-statement.builder.test.ts` | Modify | Add fixture: `aperturaBaseline` present, no prior state, typed=∅ → `SALDO_INICIAL` absorbs; `imbalanced=false`. |
| `features/accounting/equity-statement/__tests__/equity-statement.service.test.ts` | Modify | Mock `getAperturaPatrimonyDelta`; verify called with `(orgId, dateFrom, dateTo)` and threaded to builder. |
| `features/accounting/equity-statement/__tests__/equity-statement.integration.test.ts` | Modify | New describe: CA-only newborn company; verify full stack returns `imbalanced=false` and `SALDO_INICIAL` shows CA amount. |

---

## Interfaces / Contracts

```ts
// equity-statement.repository.ts
async getAperturaPatrimonyDelta(
  orgId: string,
  dateFrom: Date,
  dateTo: Date,
): Promise<Map<string, Prisma.Decimal>>;
// Same shape as getPatrimonioBalancesAt; joins voucher_types on code='CA';
// range [dateFrom, dateTo] inclusive; type='PATRIMONIO'; POSTED only;
// signed-net per nature; zero-deltas omitted.

// equity-statement.types.ts
export type BuildEquityStatementInput = {
  initialBalances: Map<string, Decimal>;
  finalBalances:   Map<string, Decimal>;
  accounts:        EquityAccountMetadata[];
  typedMovements:  TypedPatrimonyMovements;
  periodResult:    Decimal;
  dateFrom:        Date;
  dateTo:          Date;
  preliminary:     boolean;
  aperturaBaseline?: Map<string, Decimal>;   // NEW — optional
};
```

---

## Testing Strategy

- **Repo (unit-with-DB)**: POSTED CA in range → delta matches `SUM(credit−debit)` for ACREEDORA; CA outside range → empty; CA on ACTIVO account → excluded; DRAFT CA → excluded; wrong org → excluded.
- **Builder (pure unit)**: (a) no `aperturaBaseline` → existing behavior intact (regression for 34 tests); (b) `aperturaBaseline` present + empty `initialBalances` + typed=∅ + result=0 → `SALDO_INICIAL[col]=delta`, `imbalanced=false`; (c) `aperturaBaseline` + CA on `OTROS_PATRIMONIO` → column visibility toggles correctly.
- **Service (unit, mocked repos)**: verify 8-slot `Promise.all`; verify `getAperturaPatrimonyDelta(orgId, dateFrom, dateTo)` call args; verify map threads to builder input.
- **Integration**: newborn org (April 2026), CA Bs. 200.000 → `imbalanced=false`, `SALDO_INICIAL.CAPITAL_SOCIAL=200000`. Then simulate period N+1 → `getAperturaPatrimonyDelta` returns empty (range excludes prior CA) → no double-count.

---

## Migration / Rollout

**No migration required — additive change.**

- No schema changes.
- No data backfill (CA already seeded in `prisma/seeds/voucher-types.ts` line 19, `isAdjustment: false`).
- Optional field → zero-impact rollback via commit revert.
- No feature flag.

---

## Open Questions

None.
