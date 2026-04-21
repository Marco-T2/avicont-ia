# Tasks: apertura-patrimony-baseline

**Change**: apertura-patrimony-baseline
**Spec**: `openspec/changes/apertura-patrimony-baseline/specs/equity-statement-typed-movements/spec.md`
**Design**: `openspec/changes/apertura-patrimony-baseline/design.md`
**TDD Mode**: Strict — every production change is preceded by a RED commit

---

## Phase 1: Repository — `getAperturaPatrimonyDelta`

- [x] T01 RED: write failing test for happy-path apertura query — CA POSTED inside range, PATRIMONIO account → `aperturaBaseline` returns `Map{ CAPITAL_SOCIAL: 200000 }` (REQ-APERTURA-MERGE scenario 1)
- [x] T02 RED: write failing test for out-of-range CA → method returns empty map (REQ-APERTURA-MERGE scenario 6)
- [x] T03 RED: write failing test for CA on non-PATRIMONIO account → line excluded from map (REQ-APERTURA-MERGE scenario 4)
- [x] T04 RED: write failing test for DRAFT CA exclusion → method returns empty map (REQ-APERTURA-MERGE scenario 5)
- [x] T05 RED: write failing test for multi-CA same period SUM aggregation → `Map{ CAPITAL_SOCIAL: 200000 }` from two entries of 150k + 50k (REQ-APERTURA-MERGE scenario 3)
- [x] T06 GREEN: implement `getAperturaPatrimonyDelta(orgId, dateFrom, dateTo)` in `equity-statement.repository.ts` — raw SQL aggregate of POSTED JournalLines joined to `VoucherTypeCfg` on `code='CA'`, date range `[dateFrom, dateTo]` inclusive, `a.type='PATRIMONIO'`, signed-net per nature, zero-deltas omitted — makes T01–T05 pass

---

## Phase 2: Types — `aperturaBaseline` on `BuildEquityStatementInput`

- [x] T07 GREEN: add optional `aperturaBaseline?: Map<string, Decimal>` field to `BuildEquityStatementInput` in `equity-statement.types.ts` — optionality is verified naturally: T09 exercises the new field while the 34 existing builder tests (which omit it) remain green. No dedicated RED needed; the field's semantics are covered by T09.

---

## Phase 3: Builder — merge `aperturaBaseline` into `initialByColumn` pre-invariant

- [x] T09 RED: write failing builder test — `aperturaBaseline = { CAPITAL_SOCIAL: 200000 }`, empty `initialBalances`, `typedMovements=∅`, `periodResult=0` → `SALDO_INICIAL[CAPITAL_SOCIAL] = 200000` and `imbalanced === false` (REQ-3 MODIFIED scenario "CA en primer período no dispara imbalance")
- [x] T10 RED: write failing builder test — `aperturaBaseline` omitted (field absent) → existing behavior unchanged, CA NOT absorbed, `imbalanced === true` if delta is unaccounted (REQ-3 MODIFIED scenario "CA sin aperturaBaseline mantiene comportamiento previo")
- [ ] T11 GREEN: implement apertura merge in `equity-statement.builder.ts` — after computing `initialByColumn`, if `aperturaBaseline` is present, iterate each `accountId → delta` and add into its mapped column via the existing `accountColumn` lookup; runs BEFORE invariant check — makes T09 and T10 pass; all 34 existing builder tests remain green

---

## Phase 4: Service — wiring `getAperturaPatrimonyDelta` into `Promise.all`

- [ ] T12 RED: write failing service unit test (mocked repos) — `getAperturaPatrimonyDelta` is called with `(orgId, dateFrom, dateTo)` and the returned map is threaded through to the builder's `aperturaBaseline` input field; verify 8-slot `Promise.all` shape
- [ ] T13 GREEN: add 8th slot to `Promise.all` in `equity-statement.service.ts` and pass `aperturaBaseline` to builder — makes T12 pass

---

## Phase 5: Integration — end-to-end new company CA absorption

- [ ] T14 RED: write failing integration test — newborn org, CA Bs. 200.000 POSTED April 2026, period `[01/04/2026, 30/04/2026]` → full stack returns `imbalanced === false` and `SALDO_INICIAL.CAPITAL_SOCIAL === 200000`
- [ ] T15 RED: write failing integration test — same org, period N+1 `[01/05/2026, 31/05/2026]` → `getAperturaPatrimonyDelta` returns empty (CA outside range); `prior-state` via `getPatrimonioBalancesAt(dayBefore)` absorbs the CA; no double-count (REQ-APERTURA-MERGE scenario 2)
- [ ] T16 VERIFY: integration tests T14 and T15 should pass once Phases 1–4 are complete; if not, adjust wiring — no isolated production change expected here

---

## Phase 6: Regression guards

- [ ] T17 RED ⚠️ REGRESSION GUARD — CRITICAL, DO NOT REMOVE: write a test in `equity-statement.repository.test.ts` that asserts `getAperturaPatrimonyDelta(orgId, dateFrom, dateTo)` returns an empty map when a POSTED CA exists strictly before `dateFrom` (e.g., CA dated 20/04/2026, method called with `dateFrom = 01/05/2026`). The test MUST include an inline code comment: `// REGRESSION GUARD: if someone relaxes "je.date >= dateFrom" in getAperturaPatrimonyDelta, this test will fail because period N+1 would re-include the prior-period CA, causing double-count when merged with initialBalances from getPatrimonioBalancesAt. DO NOT REMOVE.` This test passes with T06's correct implementation and fails if the lower bound of the date range is ever relaxed.
- [ ] T18 VERIFY: this test is designed to fail when the guard is relaxed; it PASSES with the correct `[dateFrom, dateTo]` guard already implemented in T06 — no additional production code required

---

## Definition of Done

- [ ] All RED tests written first, committed before any production change: `test(apertura): <description>`
- [ ] All GREEN implementations follow immediately, one commit per phase: `feat(apertura): <description>`
- [ ] Full vitest suite passes (`pnpm vitest run`)
- [ ] TypeScript typecheck passes (`pnpm tsc --noEmit`)
- [ ] Manual smoke — April 2026 newborn company: `SALDO_INICIAL.CAPITAL_SOCIAL = 200000`, `imbalanced = false`, no banner
- [ ] Manual smoke — period N+1 (May 2026): `SALDO_INICIAL` shows carried balance via `getPatrimonioBalancesAt`, `aperturaBaseline` returns empty, no double-count

---

## Commit message conventions

```
test(apertura): <what scenario is covered>    ← RED commit, before any prod code
feat(apertura): <what is implemented>         ← GREEN commit
refactor(apertura): <what was cleaned up>     ← optional REFACTOR commit
```

---

## File Index

| File | Phase | Action |
|------|-------|--------|
| `features/accounting/equity-statement/__tests__/equity-statement.repository.test.ts` | 1 | Add T01–T05 test cases |
| `features/accounting/equity-statement/equity-statement.repository.ts` | 1 | Add `getAperturaPatrimonyDelta` |
| `features/accounting/equity-statement/equity-statement.types.ts` | 2 | Add optional `aperturaBaseline` field (T07) |
| `features/accounting/equity-statement/__tests__/equity-statement.builder.test.ts` | 3 | Add T09–T10 test cases |
| `features/accounting/equity-statement/equity-statement.builder.ts` | 3 | Implement apertura merge pre-invariant |
| `features/accounting/equity-statement/__tests__/equity-statement.service.test.ts` | 4 | Add T12 test case |
| `features/accounting/equity-statement/equity-statement.service.ts` | 4 | Wire 8th `Promise.all` slot |
| `features/accounting/equity-statement/__tests__/equity-statement.integration.test.ts` | 5 | Add T14–T15 describe block |
| `features/accounting/equity-statement/__tests__/equity-statement.repository.test.ts` | 6 | Add T17 regression guard test |
