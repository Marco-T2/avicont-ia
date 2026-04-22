# Tasks — fiscal-period-monthly-create

Date: 2026-04-21
Strict TDD: RED commit → run → see RED → GREEN commit → run → see GREEN. No batching. No shortcuts.
Conventional commits only. NO Co-Authored-By. NO --no-verify. NO --amend.

---

## Strict TDD Commandments

1. **RED commit first.** Run. See RED. THEN and only then write GREEN.
2. **One behavior per RED.** Parametrization hides coverage gaps — REQ-8's 7 separate `it()` blocks
   are not stylistic preference, they are the anti-omission mechanism. One bundled test means one
   missed case.
3. **`[ATOMIC COMMIT]` tasks are non-negotiable.** Touch ALL listed files in a SINGLE commit. A
   split that lands the type without the consumers, or the payload without the test fixtures, WILL
   produce a broken build between commits. The atomic marker is there so the apply agent cannot
   rationalize skipping it.

---

## Phase 0 — Preconditions

Tasks that set up types, constants, or fixtures that no test or service can compile without.

---

- [ ] **T01** — Add `FISCAL_PERIOD_MONTH_EXISTS` constant to `features/shared/errors.ts`
  - **Purpose**: REQ-3 — the new ConflictError code for month-level uniqueness violations. Every
    subsequent service test that imports this constant will fail to compile until this lands.
  - **Kind**: GREEN (no observable behavior — compiler precondition only)
  - **Touches**: `features/shared/errors.ts`
  - **Depends on**: none
  - **Parallel-safe**: yes
  - **Acceptance**: `FISCAL_PERIOD_MONTH_EXISTS` is exported; `pnpm tsc --noEmit` passes; no
    existing tests fail.
  - **Commit**: `chore(errors): add FISCAL_PERIOD_MONTH_EXISTS constant`

---

## Phase 1 — Month-aware creation (REQ-1, REQ-2, REQ-3)

Introduces `findByYearAndMonth`, rewrites `FiscalPeriodsService.create()`, adds P2002 mapping and
es-BO month names. Covers the 3 multiplicity tests mandated by REQ-8 items 1-2 and the conflict
scenario for REQ-3.

---

- [ ] **T02** — RED: "creates second period in same year" (F-01 multiplicity)
  - **Purpose**: REQ-1 Scenario 1.1 / REQ-8 item 1 — exposes the `findByYear` guard that blocks
    month 2-12. MUST be a standalone `it()` block.
  - **Kind**: RED
  - **Touches**: `features/fiscal-periods/__tests__/fiscal-periods.service.multiplicity.test.ts`
    (new file)
  - **Depends on**: T01
  - **Acceptance**: test named `"creates second period in same year"` exists and FAILS (service
    throws `FISCAL_PERIOD_YEAR_EXISTS` because the guard is still present).
  - **Commit**: `test(fiscal-periods): RED - creates second period in same year`

- [ ] **T03** — RED: "creates period with another OPEN existing" (F-02 multiplicity)
  - **Purpose**: REQ-2 Scenario 2.1 / REQ-8 item 2 — exposes the `findOpenPeriod` guard that blocks
    creating any new period while another is OPEN. MUST be a standalone `it()` block in the same file.
    The test's mock repo MUST NOT expose `findOpenPeriod` — its absence is the structural guarantee.
  - **Kind**: RED
  - **Touches**: `features/fiscal-periods/__tests__/fiscal-periods.service.multiplicity.test.ts`
  - **Depends on**: T02 (same file — add to it)
  - **Acceptance**: test named `"creates period with another OPEN existing"` exists and FAILS
    (service throws `ACTIVE_PERIOD_ALREADY_EXISTS` because the guard is still present).
  - **Commit**: `test(fiscal-periods): RED - creates period with another OPEN existing`

- [ ] **T04** — RED: "throws ConflictError FISCAL_PERIOD_MONTH_EXISTS for duplicate (year, month)"
    (REQ-3 Scenario 3.1)
  - **Purpose**: REQ-3 Scenario 3.1 — duplicate month in same year returns the new code + es-BO
    month name in the message.
  - **Kind**: RED
  - **Touches**: `features/fiscal-periods/__tests__/fiscal-periods.service.multiplicity.test.ts`
  - **Depends on**: T03 (same file)
  - **Acceptance**: test named `"throws ConflictError FISCAL_PERIOD_MONTH_EXISTS for duplicate
    (year, month)"` exists and FAILS (service currently throws `FISCAL_PERIOD_YEAR_EXISTS`, wrong
    code).
  - **Commit**: `test(fiscal-periods): RED - throws FISCAL_PERIOD_MONTH_EXISTS for duplicate month`

- [ ] **T05** — RED + GREEN [ATOMIC COMMIT]: P2002 trip-wire — maps `fiscal_periods_organizationId_year_month_key` to ConflictError (REQ-3 Scenario 3.2)
  - **Purpose**: REQ-3 Scenario 3.2 — race-condition P2002 is caught and mapped, NOT propagated raw.
    The trip-wire test's purpose is to fail loudly if Prisma ever renames the index. The test and
    the mapping logic MUST land in the same commit so the test immediately guards what it introduces.
  - **Kind**: RED (test) + GREEN (mapping logic in `create()`) — ONE ATOMIC COMMIT. No split.
  - **Touches**:
    - `features/fiscal-periods/__tests__/fiscal-periods.service.multiplicity.test.ts` (RED test named
      `"catches P2002 on fiscal_periods_organizationId_year_month_key and throws FISCAL_PERIOD_MONTH_EXISTS"`)
    - `features/fiscal-periods/fiscal-periods.service.ts` (the `try/catch` around `repo.create`
      with `isPrismaUniqueViolation("fiscal_periods_organizationId_year_month_key")`)
  - **Depends on**: T04 (all three prior REDs unblock the GREEN implementation in this task)
  - **Notes**: INCLUDES: trip-wire test + P2002 catch in `create()` service — ATOMIC. The exact
    index string `"fiscal_periods_organizationId_year_month_key"` MUST appear in both the test
    assertion and the service catch, so any Prisma rename fails both visibly.
  - **Acceptance**: test named `"catches P2002 on fiscal_periods_organizationId_year_month_key and
    throws FISCAL_PERIOD_MONTH_EXISTS"` PASSES. `pnpm tsc --noEmit` passes.
  - **Commit**: `feat(fiscal-periods): catch P2002 on organizationId_year_month index and map to FISCAL_PERIOD_MONTH_EXISTS`

- [ ] **T06** — GREEN: add `findByYearAndMonth` to `FiscalPeriodsRepository`
  - **Purpose**: REQ-1/REQ-3 — the new repo method that replaces `findByYear` as the uniqueness
    pre-check in `create()`. The method queries `WHERE organizationId, year, month` using `findFirst`.
  - **Kind**: GREEN
  - **Touches**: `features/fiscal-periods/fiscal-periods.repository.ts`
  - **Depends on**: T01 (constant exists), T02, T03, T04 (RED tests exist and fail — TDD order)
  - **Acceptance**: method `findByYearAndMonth(organizationId, year, month)` exists and returns
    `Promise<FiscalPeriod | null>`; TypeScript compiles; all existing repository tests pass.
  - **Commit**: `feat(fiscal-periods): add findByYearAndMonth to FiscalPeriodsRepository`

- [ ] **T07** — GREEN: rewrite `FiscalPeriodsService.create()` — derive month, call `findByYearAndMonth`, remove `findByYear` guard, remove `findOpenPeriod` guard, add es-BO `MONTH_NAMES_ES` constant, wire `FISCAL_PERIOD_MONTH_EXISTS` throw
  - **Purpose**: REQ-1, REQ-2, REQ-3 — makes T02, T03, T04 go GREEN. The service derivation formula
    is `input.startDate.getUTCMonth() + 1` (1-indexed, matching `repo.create`). `MONTH_NAMES_ES` is
    defined locally in `fiscal-periods.service.ts` (single consumer — no shared helper justified).
    Both the `findByYear` guard call and the `findOpenPeriod` guard call are DELETED here.
  - **Kind**: GREEN (unblocks T02, T03, T04)
  - **Touches**: `features/fiscal-periods/fiscal-periods.service.ts`
  - **Depends on**: T06 (repo method exists)
  - **Acceptance**: T02 ("creates second period in same year") PASSES. T03 ("creates period with
    another OPEN existing") PASSES. T04 ("throws ConflictError FISCAL_PERIOD_MONTH_EXISTS") PASSES.
    `pnpm tsc --noEmit` passes.
  - **Commit**: `feat(fiscal-periods): rewrite create() with month-scoped uniqueness and remove OPEN guard`

---

## Phase 2 — Draft check widening (REQ-4, REQ-5, REQ-6)

Introduces `validateCanClose()`, widens `countDraftDocuments` to 5 entities, wires both `close()`
and `getSummary()` through the shared validator. The 5 unit multiplicity tests for REQ-8 items 3-7
and the 5 integration side-effect tests live here.

---

- [ ] **T08** — RED: "throws PERIOD_HAS_DRAFT_ENTRIES when one DRAFT Dispatch exists" (F-03 Dispatch)
  - **Purpose**: REQ-4 Scenario 4.1 / REQ-8 item 3 — the first of 5 independent entity tests.
    MUST be a standalone `it()` block; mock `countDraftDocuments` returns
    `{ dispatches: 1, payments: 0, journalEntries: 0, sales: 0, purchases: 0 }`.
    Also asserts `error.details.dispatches === 1` AND all other detail keys are 0 AND user-facing
    message contains "despacho(s)".
  - **Kind**: RED
  - **Touches**: `features/monthly-close/__tests__/monthly-close.service.multiplicity.test.ts`
    (new file)
  - **Depends on**: T01 (constant for error code import)
  - **Parallel-safe**: yes (independent file from Phase 1 tests)
  - **Acceptance**: test named `"throws PERIOD_HAS_DRAFT_ENTRIES when one DRAFT Dispatch exists"`
    exists and FAILS (current code only checks 3 entities; `details.sales` does not exist yet).
  - **Commit**: `test(monthly-close): RED - throws PERIOD_HAS_DRAFT_ENTRIES for one DRAFT Dispatch`

- [ ] **T09** — RED: "throws PERIOD_HAS_DRAFT_ENTRIES when one DRAFT Payment exists" (F-03 Payment)
  - **Purpose**: REQ-4 Scenario 4.2 / REQ-8 item 4 — standalone `it()` block; mock returns
    `{ dispatches: 0, payments: 1, journalEntries: 0, sales: 0, purchases: 0 }`.
    Asserts `details.payments === 1`, others 0, message contains "pago(s)".
  - **Kind**: RED
  - **Touches**: `features/monthly-close/__tests__/monthly-close.service.multiplicity.test.ts`
  - **Depends on**: T08 (same file — add to it)
  - **Acceptance**: test named `"throws PERIOD_HAS_DRAFT_ENTRIES when one DRAFT Payment exists"`
    exists and FAILS.
  - **Commit**: `test(monthly-close): RED - throws PERIOD_HAS_DRAFT_ENTRIES for one DRAFT Payment`

- [ ] **T10** — RED: "throws PERIOD_HAS_DRAFT_ENTRIES when one DRAFT JournalEntry exists"
    (F-03 JournalEntry)
  - **Purpose**: REQ-4 Scenario 4.3 / REQ-8 item 5 — standalone `it()` block; mock returns
    `{ dispatches: 0, payments: 0, journalEntries: 1, sales: 0, purchases: 0 }`.
    Asserts `details.journalEntries === 1`, others 0, message contains "asiento(s) de diario".
  - **Kind**: RED
  - **Touches**: `features/monthly-close/__tests__/monthly-close.service.multiplicity.test.ts`
  - **Depends on**: T09 (same file)
  - **Acceptance**: test named `"throws PERIOD_HAS_DRAFT_ENTRIES when one DRAFT JournalEntry exists"`
    exists and FAILS.
  - **Commit**: `test(monthly-close): RED - throws PERIOD_HAS_DRAFT_ENTRIES for one DRAFT JournalEntry`

- [ ] **T11** — RED: "throws PERIOD_HAS_DRAFT_ENTRIES when one DRAFT Sale exists" (F-03 Sale — NEW)
  - **Purpose**: REQ-4 Scenario 4.4 / REQ-8 item 6 — NEW entity not previously checked.
    Standalone `it()` block; mock returns `{ dispatches: 0, payments: 0, journalEntries: 0, sales: 1, purchases: 0 }`.
    Asserts `details.sales === 1`, others 0, message contains "venta(s)".
  - **Kind**: RED
  - **Touches**: `features/monthly-close/__tests__/monthly-close.service.multiplicity.test.ts`
  - **Depends on**: T10 (same file)
  - **Acceptance**: test named `"throws PERIOD_HAS_DRAFT_ENTRIES when one DRAFT Sale exists"`
    exists and FAILS (current code: `details.sales` is absent — the key is not on the payload).
  - **Commit**: `test(monthly-close): RED - throws PERIOD_HAS_DRAFT_ENTRIES for one DRAFT Sale`

- [ ] **T12** — RED: "throws PERIOD_HAS_DRAFT_ENTRIES when one DRAFT Purchase exists"
    (F-03 Purchase — NEW)
  - **Purpose**: REQ-4 Scenario 4.5 / REQ-8 item 7 — NEW entity not previously checked.
    Standalone `it()` block; mock returns `{ dispatches: 0, payments: 0, journalEntries: 0, sales: 0, purchases: 1 }`.
    Asserts `details.purchases === 1`, others 0, message contains "compra(s)".
  - **Kind**: RED
  - **Touches**: `features/monthly-close/__tests__/monthly-close.service.multiplicity.test.ts`
  - **Depends on**: T11 (same file)
  - **Acceptance**: test named `"throws PERIOD_HAS_DRAFT_ENTRIES when one DRAFT Purchase exists"`
    exists and FAILS (current code: `details.purchases` is absent).
  - **Commit**: `test(monthly-close): RED - throws PERIOD_HAS_DRAFT_ENTRIES for one DRAFT Purchase`

- [ ] **T13** — RED: integration side-effect — Dispatch DRAFT blocks close without mutating state
  - **Purpose**: REQ-4 Scenario 4.1 side-effects — `period.status` remains OPEN, the DRAFT Dispatch
    row is unchanged, no AuditLog STATUS_CHANGE for the period is emitted. Integration test (real DB).
    Standalone `it()` block.
  - **Kind**: RED
  - **Touches**: `features/monthly-close/__tests__/monthly-close.integration.test.ts` (new describe
    block within existing file)
  - **Depends on**: T08 (unit RED for this entity exists first)
  - **Acceptance**: integration test named `"Dispatch DRAFT blocks close — period.status and DRAFT row
    unchanged, no AuditLog emitted"` exists and FAILS or PASSES depending on current implementation;
    expected to FAIL because Sale/Purchase keys are missing from details assertion.
  - **Commit**: `test(monthly-close): RED integration - Dispatch DRAFT does not mutate period or emit audit`

- [ ] **T14** — RED: integration side-effect — Payment DRAFT blocks close without mutating state
  - **Purpose**: REQ-4 Scenario 4.2 side-effects — same three assertions as T13 but for Payment.
    Standalone `it()` block.
  - **Kind**: RED
  - **Touches**: `features/monthly-close/__tests__/monthly-close.integration.test.ts`
  - **Depends on**: T09, T13 (same describe block)
  - **Acceptance**: test named `"Payment DRAFT blocks close — period.status and DRAFT row unchanged,
    no AuditLog emitted"` exists and FAILS.
  - **Commit**: `test(monthly-close): RED integration - Payment DRAFT does not mutate period or emit audit`

- [ ] **T15** — RED: integration side-effect — JournalEntry DRAFT blocks close without mutating state
  - **Purpose**: REQ-4 Scenario 4.3 side-effects — same three assertions for JournalEntry.
    Standalone `it()` block.
  - **Kind**: RED
  - **Touches**: `features/monthly-close/__tests__/monthly-close.integration.test.ts`
  - **Depends on**: T10, T14 (same describe block)
  - **Acceptance**: test named `"JournalEntry DRAFT blocks close — period.status and DRAFT row
    unchanged, no AuditLog emitted"` exists and FAILS.
  - **Commit**: `test(monthly-close): RED integration - JournalEntry DRAFT does not mutate period or emit audit`

- [ ] **T16** — RED: integration side-effect — Sale DRAFT blocks close without mutating state (NEW)
  - **Purpose**: REQ-4 Scenario 4.4 side-effects — Sale is the first NEW entity. Integration test
    must seed a DRAFT Sale and verify the close is rejected, period.status stays OPEN, Sale remains
    DRAFT, no audit. Standalone `it()` block.
  - **Kind**: RED
  - **Touches**: `features/monthly-close/__tests__/monthly-close.integration.test.ts`
  - **Depends on**: T11, T15 (same describe block)
  - **Acceptance**: test named `"Sale DRAFT blocks close — period.status and DRAFT row unchanged, no
    AuditLog emitted"` exists and FAILS (Sale is not currently counted).
  - **Commit**: `test(monthly-close): RED integration - Sale DRAFT does not mutate period or emit audit`

- [ ] **T17** — RED: integration side-effect — Purchase DRAFT blocks close without mutating state
    (NEW)
  - **Purpose**: REQ-4 Scenario 4.5 side-effects — same three assertions for Purchase.
    Standalone `it()` block.
  - **Kind**: RED
  - **Touches**: `features/monthly-close/__tests__/monthly-close.integration.test.ts`
  - **Depends on**: T12, T16 (same describe block)
  - **Acceptance**: test named `"Purchase DRAFT blocks close — period.status and DRAFT row unchanged,
    no AuditLog emitted"` exists and FAILS (Purchase is not currently counted).
  - **Commit**: `test(monthly-close): RED integration - Purchase DRAFT does not mutate period or emit audit`

- [ ] **T18** — RED: SHARE contract — `getSummary.drafts` numerically equals `close() error.details`
    for identical fixture (REQ-5 Scenario 5.3)
  - **Purpose**: REQ-5 Scenario 5.3 — mandatory regardless of SHARE vs SPLIT. Catches drift between
    the two paths. If `validateCanClose()` is later re-split, this test fails immediately.
    One `it()` block: mock `countDraftDocuments` returning 5 non-zero values; call both `getSummary`
    and `close()` with identical mocks; assert `summary.drafts` deep-equals `error.details`.
  - **Kind**: RED
  - **Touches**: `features/monthly-close/__tests__/monthly-close.service.share-contract.test.ts`
    (new file)
  - **Depends on**: T08 (unit multiplicity tests exist — validates same test context)
  - **Parallel-safe**: yes (independent file)
  - **Acceptance**: test named `"getSummary and close report identical draft counts for the same
    period state"` exists and FAILS (current `getSummary` only returns 3-key `drafts`; the
    deep-equals against a 5-key `error.details` fails).
  - **Commit**: `test(monthly-close): RED - getSummary and close share the same draft count source`

- [ ] **T19** — RED: `expectTypeOf<MonthlyCloseSummary["drafts"]>` has exactly 5 keys
    (REQ-6 / Design D4)
  - **Purpose**: REQ-6 — type-level assertion that `MonthlyCloseSummary.drafts` carries all 5 keys.
    Fails until B4 widens the interface. This is a compile-time RED.
  - **Kind**: RED
  - **Touches**: `features/monthly-close/__tests__/monthly-close.types.test.ts`
  - **Depends on**: none (type assertion file — no runtime dependency)
  - **Parallel-safe**: yes
  - **Acceptance**: `expectTypeOf<MonthlyCloseSummary["drafts"]>().toEqualTypeOf<{ dispatches: number;
    payments: number; journalEntries: number; sales: number; purchases: number }>()` exists and FAILS
    at compile time (or at runtime in the vitest type-check run) because `sales` and `purchases` are
    absent from the current interface.
  - **Commit**: `test(monthly-close): RED - expectTypeOf MonthlyCloseSummary drafts has 5 keys`

- [ ] **T19b** — RED: `validateCanClose` contract — 2 independent `it()` blocks for the method's own spec
  - **Purpose**: REQ-5 / Design B3 — `validateCanClose()` is the shared single source of truth;
    it MUST have dedicated unit tests so regressions in the shared method manifest as direct
    failures in its own test file, not as side-effect failures in consumer tests (`close()`,
    `getSummary()`). Without this, a regression in the sum or the `canClose` predicate would
    surface as a seemingly-unrelated failure in T08 or T18, and diagnosis gets harder.
    Two standalone `it()` blocks in a new isolated test file:
    - `"returns 7-key object with entity counts, total, and canClose=false when drafts exist"` —
      mock `countDraftDocuments` returning `{ dispatches: 1, payments: 2, journalEntries: 3, sales: 4, purchases: 5 }`;
      assert `validateCanClose(orgId, periodId)` deep-equals
      `{ dispatches: 1, payments: 2, journalEntries: 3, sales: 4, purchases: 5, total: 15, canClose: false }`.
    - `"returns canClose=true and total=0 when all entity counts are zero"` — mock returns all
      zeros; assert `total: 0, canClose: true`, and all 5 entity keys are present with value 0.
  - **Kind**: RED
  - **Touches**: `features/monthly-close/__tests__/monthly-close.service.validate-can-close.test.ts`
    (new file)
  - **Depends on**: T01 (no runtime prerequisites — isolated test file with mocked repository)
  - **Parallel-safe**: yes
  - **Notes**: Visibility of `validateCanClose` is `public` (changed from `private` in the design)
    so this test can call the method directly without bracket-notation casts. The architectural
    rationale: a shared SOT is by definition callable from multiple legitimate sites — making it
    public is honest about that role and enables future UI pre-flight queries (e.g., a hook that
    disables the Close button when `canClose === false`).
  - **Acceptance**: both `it()` blocks exist and BOTH FAIL (method does not exist yet — no export,
    no implementation).
  - **Commit**: `test(monthly-close): RED - validateCanClose returns 7-key object with 5 entity counts + total + canClose`

- [ ] **T20** — GREEN: introduce `MonthlyCloseService.validateCanClose()` public method
  - **Purpose**: REQ-5 — the shared single source of truth for "draft documents blocking close".
    Signature: `public async validateCanClose(organizationId, periodId): Promise<{ dispatches, payments, journalEntries, sales, purchases, total, canClose }>`.
    Calls `this.repo.countDraftDocuments(organizationId, periodId)`, derives `total` and `canClose`.
    Does NOT wire into `close()` or `getSummary()` yet — those are T22 and T23. This task introduces
    the method in isolation first so T21's GREEN can depend on it.
  - **Kind**: GREEN (unblocks T19b)
  - **Touches**: `features/monthly-close/monthly-close.service.ts`
  - **Depends on**: T18 (SHARE contract RED exists), T19 (type RED exists), T19b (own-spec RED exists)
  - **Notes**: `countDraftDocuments` still returns 3 keys at this point — this task only introduces
    the method wrapper; the repo widening happens in T21 (ATOMIC COMMIT). Visibility is `public`
    (not `private` as the design initially stated) so `validateCanClose` can be unit-tested
    independently and queried by future UI consumers — see T19b Notes.
  - **Acceptance**: T19b both `it()` blocks PASS. `validateCanClose` public method exists on
    `MonthlyCloseService`; TypeScript compiles; existing tests pass.
  - **Commit**: `feat(monthly-close): introduce validateCanClose shared method`

- [ ] **T21** — [ATOMIC COMMIT] GREEN: widen `countDraftDocuments` to 5 entities + update producer
    + update all 4 consumer test sites (Design A3)
  - **Purpose**: REQ-4 — the repository method returns all 5 entity draft counts. This is a
    breaking shape change for `toEqual` assertions in test files. ALL changes ship in one commit to
    prevent a broken build window between the repo change and the test updates.
  - **Kind**: GREEN — ATOMIC COMMIT. Touch ALL listed files in ONE commit.
  - **Touches** (INCLUDES ALL OF THESE — ATOMIC):
    - `features/monthly-close/monthly-close.repository.ts` — extend `countDraftDocuments` to
      5-count `Promise.all`; also widen `countByStatus` entity-type union to include `"sale"` and
      `"purchase"` (Design B2).
    - `features/monthly-close/__tests__/monthly-close.repository.test.ts` — update 3 `toEqual`
      assertions at lines 202, 207, 227, 230 to include `sales: 0, purchases: 0` (Design A3 item 5).
    - `features/monthly-close/__tests__/monthly-close.service.test.ts` — update T26 mock (lines
      136-155) to 5-key object + add `sales`/`purchases` assertions; update T27 and other
      `countDraftDocuments` mocks (lines 172-176, 222-225) to add `sales: 0, purchases: 0`
      (Design A3 items 2 and 3).
    - `app/api/organizations/[orgSlug]/monthly-close/__tests__/route.test.ts` — update
      `ValidationError` construction in fixture (line 189-193) to include all 5 keys (Design A3
      item 4).
    - `features/monthly-close/monthly-close.service.ts` — update the `ValidationError` throw in
      `close()` to pass all 5 keys to the `details` payload (Design A3 item 1); update the message
      builder to include `venta(s)` and `compra(s)`; fix terminology from `asiento(s)` to
      `asiento(s) de diario` per Spec B.
  - **Depends on**: T20 (`validateCanClose` method exists)
  - **Acceptance**: T08-T12 (all 5 unit multiplicity RED tests) PASS. Repository `toEqual`
    assertions pass. `pnpm tsc --noEmit` passes. `pnpm vitest run` — zero failures.
  - **Commit**: `feat(monthly-close): widen countDraftDocuments to 5 entities and update all consumers\n\nTouches: monthly-close.repository.ts, monthly-close.repository.test.ts, monthly-close.service.ts, monthly-close.service.test.ts, route.test.ts`

- [ ] **T22** — GREEN: wire `close()` to call `validateCanClose()` as the pre-TX guard, replacing
    `countDraftDocuments` direct call
  - **Purpose**: REQ-5 — `close()` reads drafts through the shared method, not by calling
    `countDraftDocuments` directly. After T21, the payload is already 5-key; this task changes the
    call site from `this.repo.countDraftDocuments(...)` to `this.validateCanClose(...)` and uses
    `drafts.canClose` to branch.
  - **Kind**: GREEN (unblocks T18 SHARE contract test)
  - **Touches**: `features/monthly-close/monthly-close.service.ts`
  - **Depends on**: T21 (ATOMIC COMMIT completed — repo returns 5 keys; `validateCanClose` exists
    per T20)
  - **Acceptance**: `close()` no longer calls `this.repo.countDraftDocuments` directly; it calls
    `this.validateCanClose`. T18 (SHARE contract) PASSES. Existing `close()` tests pass.
  - **Commit**: `refactor(monthly-close): wire close() through validateCanClose shared method`

- [ ] **T23** — GREEN: wire `getSummary()` to call `validateCanClose()`, replacing 3 inline DRAFT
    `countByStatus` calls
  - **Purpose**: REQ-5, REQ-6 — `getSummary()` reads drafts from the same source as `close()`.
    The 3 inline `countByStatus` calls for DRAFT dispatches/payments/journalEntries are deleted
    and replaced by `this.validateCanClose(organizationId, periodId)` inside the existing
    `Promise.all`. The `drafts` key of the returned summary is populated from `draftsResult`.
    POSTED counts (`countByStatus` for POSTED) remain inline — not touched.
  - **Kind**: GREEN (unblocks T18, T19, T16, T17 integration tests)
  - **Touches**: `features/monthly-close/monthly-close.service.ts`
  - **Depends on**: T22 (`validateCanClose` is already wired in `close()` — confirms it works)
  - **Acceptance**: T18 (SHARE contract) PASSES. T19 (`expectTypeOf` — still RED at type level until
    T24 widens the interface). Existing `getSummary()` tests pass (after mock updates in T21).
  - **Commit**: `refactor(monthly-close): wire getSummary() through validateCanClose shared method`

---

## Phase 3 — UI and type propagation (REQ-6)

Widens `MonthlyCloseSummary.drafts` type and all UI consumers. ATOMIC to avoid a runtime crash
where the React component's local `PeriodSummary` type narrows the API response before the widened
keys are defined.

---

- [ ] **T24** — [ATOMIC COMMIT] GREEN: widen `MonthlyCloseSummary.drafts` type + update
    `MonthlyClosePanel` UI + fixture updates
  - **Purpose**: REQ-6 — `MonthlyCloseSummary.drafts` gets `sales` and `purchases`. The UI panel
    adds two new rows. ALL changes in ONE commit — a partial landing leaves the component reading
    `summary.drafts.sales` as `undefined` at runtime.
  - **Kind**: GREEN — ATOMIC COMMIT. Touch ALL listed files in ONE commit.
  - **Touches** (INCLUDES ALL OF THESE — ATOMIC):
    - `features/monthly-close/monthly-close.types.ts` — widen `MonthlyCloseSummary.drafts` to 5 keys
      (Design B4).
    - `components/settings/monthly-close-panel.tsx` — widen local `PeriodSummary` shadow type
      (line 36); update `totalDrafts()` to sum 5 keys (line 64-66); add 2 new rows for Sale
      ("Ventas") and Purchase ("Compras") in the UI (lines 245-257). Spanish labels per Design B4.
    - `components/settings/__tests__/monthly-close-panel.test.tsx` — add `sales: 0, purchases: 0`
      to `drafts` fixture (line 63) (Design B4 item 4).
    - `app/api/organizations/[orgSlug]/monthly-close/summary/__tests__/route.test.ts` — add
      `sales: 0, purchases: 0` to `drafts` fixture (line 56) (Design B4 item 5).
  - **Depends on**: T23 (`getSummary()` now returns 5-key `drafts` from `validateCanClose`)
  - **Acceptance**: T19 (`expectTypeOf` type test) PASSES. `MonthlyClosePanel` renders without
    runtime errors. `pnpm tsc --noEmit` passes. All panel and route tests pass.
  - **Commit**: `feat(monthly-close): widen MonthlyCloseSummary drafts to 5 entities and update MonthlyClosePanel\n\nTouches: monthly-close.types.ts, monthly-close-panel.tsx, monthly-close-panel.test.tsx, summary/route.test.ts`

---

## Phase 4 — Retirement (order-gated)

Deletes `findOpenPeriod`, `ACTIVE_PERIOD_ALREADY_EXISTS`, and the guard block from `create()`.
Retirement MUST follow Phase 1 GREEN (T07) to ensure the new creation path is working before
removing the old one. Mandate 4: verify-first, then retire.

---

- [ ] **T25** — GREEN: delete `findOpenPeriod` guard block from `FiscalPeriodsService.create()` and
    its import of `ACTIVE_PERIOD_ALREADY_EXISTS`
  - **Purpose**: REQ-2 / Design B5 — removes the 3-line guard (`const openPeriod = ...`,
    `if (openPeriod) throw ...`) and the import of `ACTIVE_PERIOD_ALREADY_EXISTS` from the service.
    T07 already removed this guard as part of rewriting `create()`; this task is the verification
    step confirming the guard is gone and no reference remains.
  - **Kind**: GREEN / REFACTOR (confirm guard deletion from T07 and clean up any remaining import)
  - **Touches**: `features/fiscal-periods/fiscal-periods.service.ts`
  - **Depends on**: T07 (new `create()` is live and T03 test passes), T03 (RED confirmed the guard
    exists; GREEN confirmed it was removed)
  - **Notes**: if T07 already removed this code, this task is a verification pass — confirm no
    residual reference to `findOpenPeriod` or `ACTIVE_PERIOD_ALREADY_EXISTS` in the file. Either way
    the commit documents the cleanup.
  - **Acceptance**: `fiscal-periods.service.ts` contains no reference to `findOpenPeriod` or
    `ACTIVE_PERIOD_ALREADY_EXISTS`; T03 PASSES; `pnpm tsc --noEmit` passes.
  - **Commit**: `chore(fiscal-periods): remove findOpenPeriod guard and ACTIVE_PERIOD_ALREADY_EXISTS import from create()`

- [ ] **T26** — GREEN: delete `FiscalPeriodsRepository.findOpenPeriod` method
  - **Purpose**: REQ-7 Scenario 7.2 — removes the repository method itself. A2 inventory (Design)
    confirmed zero consumers beyond the guard deleted in T25. Inventory is the satisfying artifact.
  - **Kind**: GREEN
  - **Touches**: `features/fiscal-periods/fiscal-periods.repository.ts`
  - **Depends on**: T25 (service caller is gone — safe to delete the method)
  - **Acceptance**: `findOpenPeriod` method no longer exists in the repository; `pnpm tsc --noEmit`
    passes; no test references the method.
  - **Commit**: `chore(fiscal-periods): delete findOpenPeriod from FiscalPeriodsRepository`

- [ ] **T27** — GREEN: delete `ACTIVE_PERIOD_ALREADY_EXISTS` constant from `features/shared/errors.ts`
  - **Purpose**: REQ-7 Scenario 7.2 — removes the exported constant. A2 inventory confirmed 3
    reference sites (import, throw, export) — all three are already removed by T25. This task
    removes the export declaration itself.
  - **Kind**: GREEN
  - **Touches**: `features/shared/errors.ts`
  - **Depends on**: T25 (import + throw sites removed), T26 (repository method removed)
  - **Acceptance**: `ACTIVE_PERIOD_ALREADY_EXISTS` is no longer exported from `errors.ts`;
    `pnpm tsc --noEmit` passes; no test imports or references the constant.
  - **Commit**: `chore(errors): delete ACTIVE_PERIOD_ALREADY_EXISTS constant`

- [ ] **T28** — GREEN: add reservation comment to `FISCAL_PERIOD_YEAR_EXISTS` in `errors.ts`
  - **Purpose**: Design B5 / REQ-3 — explicitly marks `FISCAL_PERIOD_YEAR_EXISTS` as reserved for
    a future `FiscalYear` entity duplicate scenario. Prevents future misuse for month-level conflicts.
  - **Kind**: GREEN / REFACTOR
  - **Touches**: `features/shared/errors.ts`
  - **Depends on**: T27 (sibling constant cleanup done — same file, clean state)
  - **Parallel-safe**: yes (mechanical comment addition)
  - **Acceptance**: `FISCAL_PERIOD_YEAR_EXISTS` has an inline comment: `// Reserved for future
    FiscalYear duplicate scenario — do not reuse for month-level conflicts.`; `pnpm tsc --noEmit`
    passes.
  - **Commit**: `chore(errors): mark FISCAL_PERIOD_YEAR_EXISTS as reserved for FiscalYear scenario`

---

## Phase 5 — Full regression and polish

---

- [ ] **T29** — Full test suite and type check
  - **Purpose**: regression gate — all 7 REQ-8 multiplicity tests pass, all integration side-effect
    tests pass, SHARE contract test passes, type test passes, zero TypeScript errors.
  - **Kind**: REFACTOR (fix anything that breaks; no new behavior)
  - **Touches**: any file that fails `pnpm vitest run` or `pnpm tsc --noEmit`
  - **Depends on**: T24 (all implementation complete), T28 (housekeeping complete)
  - **Acceptance**: `pnpm vitest run` exits 0. `pnpm tsc --noEmit` exits 0. All 7 named multiplicity
    tests pass as separate `it()` blocks.
  - **Commit**: `fix(monthly-close): fix any regressions found in full vitest run`

- [ ] **T30** — Update `openspec/specs/monthly-period-close/spec.md` REQ-4 correction
  - **Purpose**: archive prep — applies the delta from
    `openspec/changes/fiscal-period-monthly-create/specs/monthly-period-close/spec.md` to the
    canonical spec. This is the archive-phase merge step; the note in the spec delta explicitly
    states the merge happens during `sdd-archive`. Mark this task as the trigger for that merge.
  - **Kind**: REFACTOR (documentation / spec sync)
  - **Touches**: `openspec/specs/monthly-period-close/spec.md`
  - **Depends on**: T29 (all tests green — implementation is verified before spec is declared
    corrected)
  - **Acceptance**: `openspec/specs/monthly-period-close/spec.md` REQ-4 enumerates all 5 entities
    (`Dispatch`, `Payment`, `JournalEntry`, `Sale`, `Purchase`) and the correction note is present.
  - **Commit**: `docs(specs): apply REQ-4 correction delta to monthly-period-close canonical spec`

---

## Dependencies

```
T01
 ├── T02 → T03 → T04 → T05 (ATOMIC: trip-wire RED + P2002 GREEN)
 │    └── T06 → T07 → T25 → T26 → T27 → T28
 ├── T08 → T09 → T10 → T11 → T12  (unit multiplicity REDs)
 │    ├── T13 → T14 → T15 → T16 → T17  (integration side-effect REDs)
 │    └── T18 (SHARE contract RED)
 │         └── T20 → T21 (ATOMIC) → T22 → T23 → T24 (ATOMIC) → T29 → T30
 └── T19b (validateCanClose own-spec RED — parallel-safe with T08-T18)
      └── resolved by T20

T19 (type RED — parallel-safe, depends on none)
 └── resolved by T24
```

### Blocking chains (apply-phase: do not start a task until ALL its depends-on are green)

| Blocked task | Blocks until |
|---|---|
| T06 | T01, T02, T03, T04 complete |
| T07 | T06 complete |
| T19b | T01 complete |
| T20 | T18, T19, T19b complete |
| T21 | T20 complete — **ATOMIC: do not split across commits** |
| T22 | T21 complete |
| T23 | T22 complete |
| T24 | T23 complete — **ATOMIC: do not split across commits** |
| T25 | T07 complete AND T03 passing |
| T26 | T25 complete |
| T27 | T25, T26 complete |
| T29 | T24, T28 complete |
| T30 | T29 complete |

### Parallel-safe groups (can be worked simultaneously)

- T02/T03/T04/T05 file (Phase 1 RED) alongside T08-T12 file (Phase 2 unit REDs) alongside T18,
  T19, and T19b — all are RED-only tasks in different files with no shared write dependency.
- T13-T17 (integration REDs) can be written in parallel with T18/T19/T19b once their corresponding
  unit REDs (T08-T12) exist.
- T28 (comment addition) is parallel-safe with T29 once T27 is done.
```
