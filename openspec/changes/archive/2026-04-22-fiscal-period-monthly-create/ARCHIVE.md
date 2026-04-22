# Archive — fiscal-period-monthly-create

**Archived:** 2026-04-22
**Outcome:** PASS_WITH_WARNINGS → archive (W-01 routed to separate change)
**Commits:** 29 across 5 checkpoint-gated phases
**Suite delta:** +14 tests (2656 → 2670, 0 failures)

## Executive summary

Repaired three CRITICAL defects inherited from the archived `cierre-periodo` change (2026-04-21):

- **F-01** — `findByYear` blocked creating a second FiscalPeriod in the same year. Replaced with `findByYearAndMonth` + P2002 trip-wire on month-scoped composite unique.
- **F-02** — `findOpenPeriod` blocked parallel OPEN periods (contradicted monthly semantics). Retired from service and repository.
- **F-03** — Silent Sale/Purchase DRAFT corruption on close. `countDraftDocuments` widened from 3 to 5 entities; shared `public validateCanClose()` SOT wired through both `close()` and `getSummary()`.

All 11 REQs PASS per sdd-verify report (obs #940). No test failures. Implementation matches canonical spec post-T30 merge. 

One WARNING (W-01) discovered during verify contradictor sweep: `features/shared/middleware.ts` `handleError` drops `AppError.details` at the HTTP serialization boundary, masking the per-entity draft counts mandated by REQ-4. This is pre-existing debt (middleware predates this change) — user approved routing it to a separate upcoming change `handleerror-details-passthrough`.

## REQ compliance snapshot

All 11 REQs PASS per sdd-verify (see engram obs #940 `sdd/fiscal-period-monthly-create/verify-report`):

- REQ-1 month-scoped uniqueness ✓
- REQ-2 no OPEN guard ✓
- REQ-3 FISCAL_PERIOD_MONTH_EXISTS + P2002 trip-wire ✓
- REQ-4 5-entity draft block (with W-01 noted) ✓
- REQ-5 validateCanClose SOT (2 consumers exactly, 0 bypass) ✓
- REQ-6 5-key MonthlyCloseSummary.drafts ✓
- REQ-7 findOpenPeriod + ACTIVE_PERIOD_ALREADY_EXISTS retired ✓
- REQ-8 7 unit multiplicity + 5 integration side-effect tests ✓
- REQ-9 post-close observable state ✓
- REQ-10 domain event deferred ✓
- REQ-11 /summary balance ✓

## Phase commit summary

29 commits across 5 checkpoint-gated phases (2026-04-21 through 2026-04-22):

**Phase 1 (T01–T07): Month-scoped creation invariant** — 7 commits
- `666e0b5` chore(errors): add FISCAL_PERIOD_MONTH_EXISTS constant [T01]
- `30fe757` test(fiscal-periods): RED - creates second period in same year [T02]
- `34d2a11` test(fiscal-periods): RED - creates period with another OPEN existing [T03]
- `d2b3840` test(fiscal-periods): RED - throws FISCAL_PERIOD_MONTH_EXISTS for duplicate month [T04]
- `a83284a` feat(fiscal-periods): catch P2002 on organizationId_year_month index and map to FISCAL_PERIOD_MONTH_EXISTS [T05 ATOMIC]
- `05fbc28` feat(fiscal-periods): add findByYearAndMonth to FiscalPeriodsRepository [T06]
- `0300849` feat(fiscal-periods): rewrite create() with month-scoped uniqueness and remove OPEN guard [T07]

**Phase 2 (T08–T24): Draft check widening and shared validateCanClose** — 18 commits
- `fe5d445` test(monthly-close): RED - throws PERIOD_HAS_DRAFT_ENTRIES for one DRAFT Dispatch [T08]
- `0c0561d` test(monthly-close): RED - throws PERIOD_HAS_DRAFT_ENTRIES for one DRAFT Payment [T09]
- `254bd65` test(monthly-close): RED - throws PERIOD_HAS_DRAFT_ENTRIES for one DRAFT JournalEntry [T10]
- `60cec4c` test(monthly-close): RED - throws PERIOD_HAS_DRAFT_ENTRIES for one DRAFT Sale [T11]
- `a5cb23f` test(monthly-close): RED - throws PERIOD_HAS_DRAFT_ENTRIES for one DRAFT Purchase [T12]
- `d64c59d` test(monthly-close): RED integration - Dispatch DRAFT does not mutate period or emit audit [T13]
- `06a7afc` test(monthly-close): RED integration - Payment DRAFT does not mutate period or emit audit [T14]
- `3ab56b7` test(monthly-close): RED integration - JournalEntry DRAFT does not mutate period or emit audit [T15]
- `d3bc2fa` test(monthly-close): RED integration - Sale DRAFT does not mutate period or emit audit [T16]
- `d5721c6` test(monthly-close): RED integration - Purchase DRAFT does not mutate period or emit audit [T17]
- `48a0330` test(monthly-close): RED - getSummary and close share the same draft count source [T18]
- `6728dc0` test(monthly-close): RED - expectTypeOf MonthlyCloseSummary drafts has 5 keys [T19]
- `007e412` test(monthly-close): RED - validateCanClose returns 7-key object with 5 entity counts + total + canClose [T19b]
- `db5996d` feat(monthly-close): introduce validateCanClose shared method [T20]
- `cac0ead` feat(monthly-close): widen countDraftDocuments to 5 entities and update all consumers [T21 ATOMIC]
- `b0aab1b` refactor(monthly-close): wire close() through validateCanClose shared method [T22]
- `098ade6` refactor(monthly-close): wire getSummary() through validateCanClose shared method [T23]
- `678ee63` feat(monthly-close): widen MonthlyCloseSummary.drafts to 5 entities + surface sales/purchases in UI [T24 ATOMIC]

**Phase 3 (T25–T28): Retirement and housekeeping** — 4 commits
- `6839c98` chore(fiscal-periods): delete findOpenPeriod from FiscalPeriodsRepository [T26]
- `4a5c59e` chore(errors): delete ACTIVE_PERIOD_ALREADY_EXISTS constant [T27]
- `8a6c2ac` chore(errors): mark FISCAL_PERIOD_YEAR_EXISTS as reserved for FiscalYear scenario [T28]

*Note: T25 (delete findOpenPeriod guard from service) was folded into T07 per strict-TDD rewrite scope.*

**Phase 4 (T29–T30): Regression gate and spec merge** — 2 commits
- (T29: full vitest run — pre-commit verification, no separate commit)
- `20dbafb` docs(specs): apply REQ-4 correction — 5-entity draft check (F-03 resolution) to monthly-period-close canonical [T30]

## Known follow-ups

### 1. **W-01 → new change `handleerror-details-passthrough`**

The production `features/shared/middleware.ts` `handleError` function (lines 39–43) serializes AppError responses as:
```ts
{ error: error.message, code: error.code }
```

The `details` field is NOT included. However, REQ-4 mandates that the response MUST include counts per entity type (`{ dispatches, payments, journalEntries, sales, purchases }`). The route test for monthly-close (at `app/api/organizations/[orgSlug]/monthly-close/__tests__/route.test.ts:52–73`) mocks `handleError` with an aspirational implementation that DOES serialize `details`, masking the gap.

**Decision**: User approved (2026-04-22) routing this to a separate dedicated change `handleerror-details-passthrough` because:
- The gap affects ALL AppError subclasses with details, not just PERIOD_HAS_DRAFT_ENTRIES.
- It is pre-existing debt (middleware.ts predates fiscal-period-monthly-create).
- Fixing it requires careful analysis of all AppError consumers — scope creep if bundled here.

**Impact**: PERIOD_HAS_DRAFT_ENTRIES and PERIOD_UNBALANCED HTTP responses will NOT include per-entity counts in production until the middleware fix lands. MUST be fixed before resuming `monthly-close-ui-reconciliation` (UI reconciliation expects to read `error.details`).

**Fix approach** (for the upcoming change): Update `handleError` to spread `details` when `error instanceof AppError && error.details`:
```ts
if (error instanceof AppError) {
  return { error: error.message, code: error.code, ...(error.details ? { details: error.details } : {}) };
}
```

### 2. **S-02 → deferred cleanup**

`FiscalPeriodsRepository.findByYear` has zero production callers since T07. Retained per design B1 as a utility with a reservation comment. Remove in a future cleanup when the comment strategy becomes noise.

### 3. **S-01 → test strengthening**

`app/api/organizations/[orgSlug]/monthly-close/__tests__/route.test.ts` uses `toMatchObject` partial match on `details`. Strengthen to assert all 5 keys explicitly when middleware fix lands.

## Lessons codified

Three permanent SDD flow rules and one operational heuristic emerged or were validated during this change:

1. **RED acceptance must specify failure mode** — Each RED test must declare the expected failure condition (e.g., "FAILS with X because of code path Y"). Silently accepting "FAILS cumple" masks implementation decisions.

2. **Mock hygiene must not be buried in wiring commits** — Default mock fixes required to wire a task (e.g., widening a mock repo method signature) must be named in the commit message or ship as a separate preceding commit. Burying them in refactor diffs masks breaking changes to test infrastructure.

3. **Retirement phases must run a fresh re-inventory gate** — When removing code (findOpenPeriod, ACTIVE_PERIOD_ALREADY_EXISTS), do NOT rely on design-phase inventory snapshots — they drift. Run a fresh grep-based search before removal, classify all hits as RESIDUAL/TEST/CONSUMER, and document the inventory in the retirement task.

4. **Aspirational mocks signal unimplemented producer contracts** — When a test mocks a shared service (e.g., handleError) with richer behavior than the real implementation provides (e.g., serializing `details`), that gap is a contract violation in production. The F-03 and W-01 discoveries were both surfaced by aspirational mocks. Verification phases must specifically search for mocks that exceed their production counterparts.

5. **Low-cost verification before irreversible steps has favorable asymmetry** — Running sdd-verify before sdd-archive costs time but catches W-01 (middleware gap), avoiding silent production data loss. Skipping verify to save time would have shipped the gap into production unnoticed.

## Engram references

- `sdd/fiscal-period-monthly-create/proposal` (obs #925) — original proposal
- `sdd/fiscal-period-monthly-create/spec` — REQ set
- `sdd/fiscal-period-monthly-create/design` — architecture decisions
- `sdd/fiscal-period-monthly-create/tasks` (obs #929) — 30-task breakdown
- `sdd/fiscal-period-monthly-create/verify-report` (obs #940) — verify PASS_WITH_WARNINGS, all 11 REQs pass
- `sdd/fiscal-period-monthly-create/verify-contradictors` (obs #939) — W-01 contradictor sweep details
- `sdd/fiscal-period-monthly-create/archive-report` — this archive entry
