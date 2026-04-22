# Design — fiscal-period-monthly-create

Date: 2026-04-21
Model: opus

## Summary

Repair the three defects (F-01 broken month invariant, F-02 contradictory OPEN guard, F-03 silent
Sale/Purchase DRAFT corruption) left by `cierre-periodo` by: (1) replacing `findByYear` with
`findByYearAndMonth` and deriving `month` from `input.startDate`, (2) deleting the `findOpenPeriod`
guard and retiring both `findOpenPeriod` and the `ACTIVE_PERIOD_ALREADY_EXISTS` constant, (3)
widening `countDraftDocuments` to 5 entities and routing BOTH `close()` and `getSummary()` through a
single shared validator. Phase A inventories confirm SHARE wins on REQ-5 (no architectural reason
to split — both paths already run outside the TX boundary and use the same repo) and that the
breaking-contract default holds (only 3 internal consumers of the details payload, all trivially
adaptable in a single refactor commit). Biggest surprise from the inventory: the `countByStatus`
duplication in `getSummary()` is not a parallel path — it is a second, weaker implementation of the
same fact, confirming REQ-5's structural-cause hypothesis.

---

## Phase A — Inventories

### A1. Callers of `findOpenPeriod`

Searched `.ts`/`.tsx` files across the entire repo for both call sites (`.findOpenPeriod(`) and
imports.

1. `features/fiscal-periods/fiscal-periods.service.ts:56` (`this.repo.findOpenPeriod(...)`)
   → USED AS: the guard that implements the F-02 bug — rejects creation when any OPEN period
     exists in the org. This is the only production call site.
   → Adaptable: delete the callsite (3-line block, including the throw).
   → Severity: — (expected — this is the bug we're fixing).

2. `features/fiscal-periods/fiscal-periods.repository.ts:32-37` (the method definition itself)
   → USED AS: repository surface. No other file references the method.
   → Adaptable: delete the method after the service callsite is removed.
   → Severity: — (zero consumers beyond the one we're removing).

**No other production code, no UI component, no API route, no test references `findOpenPeriod` by
name.** Greps for `findOpenPeriod` return only the two callsites above plus `openspec/` markdown.

**Disposition**: inventory clears REQ-7 removal gate for `findOpenPeriod`. The method AND its single
caller can be retired in this change.

---

### A2. Consumers of `ACTIVE_PERIOD_ALREADY_EXISTS` error constant

Searched for the constant name across all files (production + tests + error mappers + UI strings).

1. `features/fiscal-periods/fiscal-periods.service.ts:7` (import)
   → USED AS: imported for the throw at line 60.
   → Adaptable: delete the import line when the throw is deleted.
   → Severity: —.

2. `features/fiscal-periods/fiscal-periods.service.ts:60` (the throw)
   → USED AS: the F-02 guard's error code.
   → Adaptable: delete the throw.
   → Severity: — (the fix).

3. `features/shared/errors.ts:58` (the export)
   → USED AS: the shared error registry export.
   → Adaptable: delete the export after the import is deleted.
   → Severity: —.

**Zero references outside those three.** Not a single test file asserts on this constant. Not a
single UI error mapper consumes it. Not a single API-client union references it. Only `openspec/`
markdown (spec + proposal + audit) mentions the name, and those are design artifacts, not code.

**Disposition**: inventory clears REQ-7 removal gate for `ACTIVE_PERIOD_ALREADY_EXISTS`. The constant
can be deleted outright in the same commit that removes the guard.

---

### A3. Consumers of `PERIOD_HAS_DRAFT_ENTRIES.details` payload

Searched for every file that reads the details payload shape: `details.dispatches`,
`details.payments`, `details.journalEntries`, TS types modelling the payload, tests asserting on it.

1. `features/monthly-close/monthly-close.service.ts:127-131` (the THROW — construction site)
   → USED AS: the producer of the payload.
   → Adaptable: refactor to pass all 5 keys (`dispatches`, `payments`, `journalEntries`, `sales`,
     `purchases`) from the widened `countDraftDocuments` result.
   → Severity: —.

2. `features/monthly-close/__tests__/monthly-close.service.test.ts:136-155` (T26 test)
   → USED AS: asserts `details.dispatches === 2 && details.journalEntries === 1` after stubbing
     `countDraftDocuments` to return a 3-key object. Typed the `details` access as
     `{ dispatches?; payments?; journalEntries? }` inline.
   → Adaptable: update the mock to return 5 keys, add `sales` and `purchases` assertions, widen the
     inline type. ONE test file, one block, mechanical change.
   → Severity: —.

3. `features/monthly-close/__tests__/monthly-close.service.test.ts:172-176` and `222-225`
   (T27 PERIOD_UNBALANCED test + one other `countDraftDocuments` mock)
   → USED AS: stubs `countDraftDocuments` with a 3-key zero object to bypass the draft check.
   → Adaptable: add `sales: 0, purchases: 0` to the mock. One line per mock site.
   → Severity: —.

4. `app/api/organizations/[orgSlug]/monthly-close/__tests__/route.test.ts:187-205` ((d) case)
   → USED AS: tests 422 response body, asserts `body.details` matches `{ dispatches: 2, payments: 1 }`
     via `toMatchObject` (partial match — so extra keys won't break assertion, but the ValidationError
     is constructed with only 3 keys on line 189-193).
   → Adaptable: update the `ValidationError` construction in the test fixture to include all 5 keys;
     optionally strengthen the `toMatchObject` to also include `sales: 0, purchases: 0` to assert
     the full contract.
   → Severity: —.

5. `features/monthly-close/__tests__/monthly-close.repository.test.ts:202, 207, 227, 230`
   → USED AS: asserts `countDraftDocuments` return shape as `{ dispatches, payments, journalEntries }`
     using `toEqual` (exact-match — extra keys WILL break this).
   → Adaptable: update the three `toEqual` assertions to include `sales: 0, purchases: 0`. Strict
     equality makes this a required update.
   → Severity: — (trivially adaptable, but NOT skippable — `toEqual` with a missing key will fail).

6. `openspec/specs/monthly-period-close/spec.md:49, 59, 183` (canonical spec)
   → USED AS: documents the payload shape as `{ dispatches, payments, journalEntries }`.
   → Adaptable: the correction delta (Spec B of this change) already rewrites REQ-4 to enumerate
     5 entities. Archive-time sync copies it into the canonical spec.
   → Severity: — (handled by sdd-archive phase, not by apply).

**Zero external consumers.** No published API client type, no UI error mapper that destructures by
key set, no file outside `features/monthly-close/**` or the API route test. The `MonthlyClosePanel`
UI reads `summary.drafts.*` from the summary endpoint (which will also be widened — see A4), NOT the
error payload from `close()`. The close response error is surfaced by `error` state in the panel as
a raw string message; the panel never destructures the details payload.

**Disposition**: the breaking-contract default (REQ-4 correction delta "Breaking change acceptable")
**HOLDS**. All consumers are internal, all are trivially adaptable, zero external contracts exist.
A single refactor commit can update all five file sets above.

---

### A4. Current shape of `countByStatus` vs `countDraftDocuments`

Both methods live in `features/monthly-close/monthly-close.repository.ts`.

**`countByStatus` (lines 18-40)**
- Signature: `(organizationId, periodId, entityType: "dispatch" | "payment" | "journalEntry",
  status: "DRAFT" | "POSTED" | "LOCKED" | "VOIDED") => Promise<number>`
- Shape: ONE count for ONE (entity, status) combination. Uses a `switch` over 3 entity types.
- Query strategy: single `.count({ where: { periodId, status, ...scope } })` per call.
- Weakness: type does NOT include `sale` or `purchase` — a caller could not request their counts
  even if it wanted to. F-03's `getSummary()` drift is partly this method's fault: even if T15 had
  remembered to update `getSummary()`, the method signature would have rejected `"sale"` at compile.

**`countDraftDocuments` (lines 44-63)**
- Signature: `(organizationId, periodId) => Promise<{ dispatches; payments; journalEntries }>`
- Shape: THREE counts in one call, all for status=DRAFT, for 3 fixed entities.
- Query strategy: `Promise.all` of 3 parallel `.count` queries.
- Weakness: hard-coded to 3 entities. Sale and Purchase are absent (F-03 root cause).

**Consumer usage today**:
- `monthly-close.service.ts:39-57` — `getSummary` makes 6 `countByStatus` calls in a `Promise.all`:
  3 POSTED + 3 DRAFT, limited to dispatch/payment/journalEntry. This is the drifted inline
  implementation of the "count DRAFTs" fact.
- `monthly-close.service.ts:114` — `close` calls `countDraftDocuments(...)` once, gets 3 counts.

**Observation for Phase B SHARE vs SPLIT decision**: `getSummary()` runs OUTSIDE any transaction
(it uses the non-tx Prisma client path — see `sumDebitCreditNoTx`). `close()` also runs the draft
check OUTSIDE its `$transaction` (line 114 is pre-TX, the `repo.transaction(...)` callback begins
at line 136). Both invocations therefore share the same TX context (none). No TX boundary splits
these two callers. The only thing preventing sharing today is that `getSummary` built its own
inline version with the narrower `countByStatus` method instead of invoking `countDraftDocuments`.

---

## Phase B — Architectural decisions

### B1. Month-aware creation (REQ-1/2/3)

**Repository additions (`FiscalPeriodsRepository`)**:

New method:
```ts
async findByYearAndMonth(
  organizationId: string,
  year: number,
  month: number,
): Promise<FiscalPeriod | null> {
  const scope = this.requireOrg(organizationId);
  return this.db.fiscalPeriod.findFirst({
    where: { year, month, ...scope },
  });
}
```

Placement: immediately after the existing `findByYear` (line 24), before `findOpenPeriod` (to be
removed — see B5). Uses `findFirst` rather than `findUnique` because the composite unique key is
`[organizationId, year, month]`, which requires all three values to hit the unique index — `findFirst`
with the plain `where` reads the same index and returns null symmetrically; both compile.

**`findByYear` retention**: A1 inventory shows no production caller outside the `create()` guard
being removed. However, the method is lightweight, has zero runtime cost when unused, and the audit
listed it only in "Suggested fix scope" — not in REQ-7. Retention is neutral; retire-or-retain is a
tasks-phase decision. **Recommended**: retain `findByYear` as a utility (no cost to carry) and mark
as "no production callers — may be removed in a future cleanup" if any future maintainer wishes.
REQ-7 only mandates the inventory-gated retirement of `findOpenPeriod`, so `findByYear` is out of
scope for removal here.

**Service flow (`FiscalPeriodsService.create`)**:

```ts
async create(organizationId, input) {
  if (input.endDate <= input.startDate) throw ValidationError(INVALID_DATE_RANGE);

  const month = input.startDate.getUTCMonth() + 1;  // 1-indexed, same as repo.create

  const existing = await this.repo.findByYearAndMonth(organizationId, input.year, month);
  if (existing) {
    throw new ConflictError(
      `Ya existe un período para ${MONTH_NAMES_ES[month - 1]} de ${input.year}`,
      FISCAL_PERIOD_MONTH_EXISTS,
    );
  }

  // No findOpenPeriod guard. The (organizationId, year, month) unique index is the sole invariant.

  try {
    return await this.repo.create(organizationId, input);
  } catch (err) {
    if (isPrismaUniqueViolation(err, "fiscal_periods_organizationId_year_month_key")) {
      throw new ConflictError(
        `Ya existe un período para ${MONTH_NAMES_ES[month - 1]} de ${input.year}`,
        FISCAL_PERIOD_MONTH_EXISTS,
      );
    }
    throw err;
  }
}
```

- `MONTH_NAMES_ES` is a new local constant (`["enero", "febrero", ..., "diciembre"]`) defined in
  `fiscal-periods.service.ts` (scope-local — single consumer; no justification for a shared locale
  helper). Rationale: REQ-3 mandates es-BO month names in the user-facing message; centralising for
  one use would be premature abstraction.
- `isPrismaUniqueViolation` already exists at `features/shared/prisma-errors.ts` and accepts a
  `targetIndex` argument. We pass the concrete index name
  `"fiscal_periods_organizationId_year_month_key"` (from `prisma/migrations/20260422004238_cierre_periodo/migration.sql:89`).
- The try/catch is REQ-3 Scenario 3.2: P2002 race must map to `FISCAL_PERIOD_MONTH_EXISTS`, not
  propagate raw `PrismaClientKnownRequestError`.

**Error mapping**: P2002 on `organizationId_year_month` → `ConflictError(FISCAL_PERIOD_MONTH_EXISTS)`
with an es-BO month message. Any other P2002 (none expected here, but defensive) or any non-P2002
error rethrows unchanged.

**Constant additions and deletions (`features/shared/errors.ts`)**:
- ADD: `export const FISCAL_PERIOD_MONTH_EXISTS = "FISCAL_PERIOD_MONTH_EXISTS";`
- DELETE: `export const ACTIVE_PERIOD_ALREADY_EXISTS = "ACTIVE_PERIOD_ALREADY_EXISTS";` (cleared by
  A2).
- RETAIN: `FISCAL_PERIOD_YEAR_EXISTS` — currently only thrown by the guard we're removing, BUT the
  spec explicitly reserves this name for a future `FiscalYear` entity. A2 equivalent inventory for
  it (I ran the same search) shows zero consumers outside the guard we're removing. Nevertheless,
  keeping it "reserved" is explicit in the spec (§"Error Code Registry" note), so retaining the
  constant is a deliberate semantic preservation, not debt. Mark with a comment:
  `// Reserved for future FiscalYear duplicate scenario — do not reuse for month-level conflicts.`

---

### B2. Draft check widening to 5 entities (REQ-4)

**Repository — `countDraftDocuments` extension**:

```ts
async countDraftDocuments(
  organizationId: string,
  periodId: string,
): Promise<{
  dispatches: number;
  payments: number;
  journalEntries: number;
  sales: number;
  purchases: number;
}> {
  const scope = this.requireOrg(organizationId);
  const [dispatches, payments, journalEntries, sales, purchases] = await Promise.all([
    this.db.dispatch.count({    where: { periodId, status: "DRAFT", ...scope } }),
    this.db.payment.count({     where: { periodId, status: "DRAFT", ...scope } }),
    this.db.journalEntry.count({ where: { periodId, status: "DRAFT", ...scope } }),
    this.db.sale.count({        where: { periodId, status: "DRAFT", ...scope } }),
    this.db.purchase.count({    where: { periodId, status: "DRAFT", ...scope } }),
  ]);
  return { dispatches, payments, journalEntries, sales, purchases };
}
```

- **Query strategy**: 5 parallel `.count` calls via `Promise.all`, extending the existing 3-count
  pattern. Rejected: single raw SQL `UNION ALL` — no measurable perf advantage at the scale expected
  (small periods, indexed lookups), adds a second SQL dialect maintenance burden, and loses Prisma's
  automatic `periodId`+`organizationId`+`status` index plan verification. The existing pattern stays.
- The `countByStatus` entity-type union also needs to widen to `"sale" | "purchase"` so the shared
  path in B3 can use it; see B3.

**Service — `close()` draft check**:

```ts
const drafts = await this.validateCanClose(organizationId, periodId);  // see B3 — SHARED

if (drafts.total > 0) {
  const parts: string[] = [];
  if (drafts.dispatches > 0)     parts.push(`${drafts.dispatches} despacho(s)`);
  if (drafts.payments > 0)       parts.push(`${drafts.payments} pago(s)`);
  if (drafts.journalEntries > 0) parts.push(`${drafts.journalEntries} asiento(s) de diario`);
  if (drafts.sales > 0)          parts.push(`${drafts.sales} venta(s)`);
  if (drafts.purchases > 0)      parts.push(`${drafts.purchases} compra(s)`);

  throw new ValidationError(
    `El período tiene registros en borrador: ${parts.join(", ")}. Debe publicarlos o eliminarlos antes de cerrar`,
    PERIOD_HAS_DRAFT_ENTRIES,
    {
      dispatches:     drafts.dispatches,
      payments:       drafts.payments,
      journalEntries: drafts.journalEntries,
      sales:          drafts.sales,
      purchases:      drafts.purchases,
    },
  );
}
```

- Message terminology follows Spec B REQ-4 explicitly: `despacho(s)`, `pago(s)`, `asiento(s) de
  diario`, `venta(s)`, `compra(s)`. Spec B uses `asiento(s) de diario` (not the shorter `asiento(s)`
  currently in code). The current code at line 122 says `asiento(s)` — this is a FIX implicit in the
  spec correction: align to `asiento(s) de diario`.
- Payload carries all 5 keys on every throw, including zeros (REQ-4 hard constraint).

---

### B3. SHARE vs SPLIT — `close()` and `getSummary()` common path (REQ-5)

**Decision: SHARE.**

**Shared method**: `MonthlyCloseService.validateCanClose(organizationId, periodId)` — **public**
method on `MonthlyCloseService`. It is the single source of truth for "documents blocking close".

**Visibility rationale**: initially scoped as `private`, revised to `public` during tasks-phase
review. A shared SOT is, by definition, callable from multiple legitimate sites — `close()` and
`getSummary()` today, potentially a UI pre-flight hook tomorrow (e.g., to disable the Close button
without running the full summary round-trip). Public visibility also enables dedicated unit tests
(see tasks.md T19b) that assert the method's contract directly rather than via side-effects in
consumer tests — when `validateCanClose` regresses, the failure surfaces in its own test file,
not as a seemingly-unrelated failure in `close()` or `getSummary()` tests.

**Signature and return type**:
```ts
public async validateCanClose(
  organizationId: string,
  periodId: string,
): Promise<{
  dispatches: number;
  payments: number;
  journalEntries: number;
  sales: number;
  purchases: number;
  total: number;
  canClose: boolean;
}> {
  const drafts = await this.repo.countDraftDocuments(organizationId, periodId);
  const total = drafts.dispatches + drafts.payments + drafts.journalEntries
              + drafts.sales + drafts.purchases;
  return { ...drafts, total, canClose: total === 0 };
}
```

**TX context**: the method runs on the non-transactional `this.repo` (which uses
`this.db = prisma`). Both call sites — `close()` step 4 (pre-TX) and `getSummary()` — invoke it
outside any `$transaction`. This is safe and identical to today's behavior (A4 established that
`close()` already counts drafts pre-TX on line 114). No TX-boundary conflict.

**Call-site wiring**:

`close()`:
```ts
const drafts = await this.validateCanClose(organizationId, periodId);
if (!drafts.canClose) {
  throw new ValidationError(PERIOD_HAS_DRAFT_ENTRIES, { ... five keys from drafts }, ...);
}
```

`getSummary()`:
```ts
const [
  posted...,      // 3 POSTED counts via countByStatus (unchanged — posted is not a draft concern)
  draftsResult,   // ← the shared validator
  journalsByVoucherType,
  rawBalance,
] = await Promise.all([
  ...3 POSTED countByStatus calls...,
  this.validateCanClose(organizationId, periodId),   // REPLACES 3 inline DRAFT countByStatus calls
  this.repo.getJournalSummaryByVoucherType(...),
  this.repo.sumDebitCreditNoTx(...),
]);

return {
  ...
  drafts: {
    dispatches:     draftsResult.dispatches,
    payments:       draftsResult.payments,
    journalEntries: draftsResult.journalEntries,
    sales:          draftsResult.sales,
    purchases:      draftsResult.purchases,
  },
  ...
};
```

**Contract**: both call sites read the SAME `countDraftDocuments` 5-count return and produce the
SAME 5-key draft shape. Adding a sixth entity tomorrow requires updating ONE method
(`countDraftDocuments`); both consumers get it for free. This is REQ-5's "single source of truth"
mandate made structural.

**POSTED counts are NOT moved**: the shared validator is draft-specific. `getSummary()`'s 3 POSTED
`countByStatus` calls remain inline because POSTED counts are a summary-only concern — `close()`
does not read them. Pulling them into the shared method would violate single responsibility without
benefit.

**Why not SPLIT** (required subsection even though SHARE was chosen): the only candidate reason
identified in A4 is "getSummary is an out-of-TX read, close does a pre-TX read". Both are out-of-TX.
That is not a split reason — it's an identity. No genuine semantic difference exists. No transaction
boundary separates them. No evidence anywhere supports SPLIT. Choosing SPLIT would be rebuilding
the F-03 structural defect by design.

---

### B4. Summary shape widening (REQ-6)

Update `MonthlyCloseSummary` type in `features/monthly-close/monthly-close.types.ts:29-54`:

```ts
export interface MonthlyCloseSummary {
  periodId: string;
  periodStatus: string;
  posted: { dispatches: number; payments: number; journalEntries: number };
  drafts: {
    dispatches: number;
    payments: number;
    journalEntries: number;
    sales: number;        // NEW
    purchases: number;    // NEW
  };
  journalsByVoucherType: Array<{ code: string; name: string; count: number; totalDebit: number }>;
  balance: { balanced: boolean; totalDebit: string; totalCredit: string; difference: string };
}
```

**Consumer inventory (type-level)** — same as A3, but focused on `drafts` key destructuring:
1. `components/settings/monthly-close-panel.tsx:36` — local `PeriodSummary` shadow type mirrors the
   summary response; widen to 5 keys.
2. `components/settings/monthly-close-panel.tsx:64-66` — `totalDrafts()` currently sums 3 keys;
   update to sum 5.
3. `components/settings/monthly-close-panel.tsx:245-257` — UI renders the 3 draft counts; add 2 more
   rows for Sale and Purchase. Spanish labels: "Ventas" and "Compras".
4. `components/settings/__tests__/monthly-close-panel.test.tsx:63` — fixture `drafts: { ... }`
   stub; add `sales: 0, purchases: 0`.
5. `app/api/organizations/[orgSlug]/monthly-close/summary/__tests__/route.test.ts:56` — same fixture
   update.
6. The summary route handler (`summary/route.ts`) is a pure passthrough of `MonthlyCloseSummary` —
   no code change needed there.

---

### B5. Error-code housekeeping

- **ADD** `FISCAL_PERIOD_MONTH_EXISTS` to `features/shared/errors.ts` (placed near
  `FISCAL_PERIOD_YEAR_EXISTS`, line 57).
- **DELETE** `ACTIVE_PERIOD_ALREADY_EXISTS` from `features/shared/errors.ts:58` (cleared by A2; zero
  consumers beyond the guard being removed).
- **RETAIN** `FISCAL_PERIOD_YEAR_EXISTS` — the shipped Spec A explicitly reserves this name for a
  future `FiscalYear` duplicate scenario. Add a code comment to that effect so future maintainers
  see the reservation.
- **DELETE** `FiscalPeriodsRepository.findOpenPeriod` method itself (lines 32-37) after the service
  import and call are removed.
- **RETAIN** `PERIOD_HAS_DRAFT_ENTRIES` — the constant signature is unchanged (the constant is just
  a string); only the payload shape passed when constructing `ValidationError` with this code is
  widened. Spec B explicitly states "no new constant is introduced".

---

### B6. Breaking-contract strategy for `PERIOD_HAS_DRAFT_ENTRIES.details`

**Decision: the default "breaking acceptable" policy HOLDS.**

Rationale: A3 inventory found 0 external consumers. All 5 internal consumers (1 production throw
site + 4 test assertion sites) live in this repo, and each is trivially adaptable via a one- or
two-line change. No published TS type or API-client package depends on the 3-key shape. The UI
(`MonthlyClosePanel`) does NOT destructure the error payload — it surfaces the error message as a
string only.

**Refactor strategy**: a single GREEN commit per strict-TDD pairing updates all consumers together
with the service change. Concretely, the `B2 close()` code change and all 4 test-file updates
listed in A3 ship in the same commit (one logical refactor). The RED test that introduces the
5-key expectation (from REQ-8 multiplicity tests — see Phase D) drives the change.

**Rejected alternatives**:
- Dual payload fields (`detailsV1` and `detailsV2`): no external consumer needs versioning; this is
  internal refactoring.
- Additive-only (keep exactly 3 keys, put Sale/Purchase elsewhere): contradicts REQ-4, which
  mandates all 5 counts in the payload.
- Deprecation window: there is nothing to deprecate — no downstream consumer was ever built
  against the 3-key shape outside this repo.

---

## Phase C — Task ordering implications

Tasks phase MUST honor these dependencies:

1. **Inventory tasks gate retirement tasks (REQ-7)**. The A1/A2 inventories produced in this
   document are the inputs; the tasks phase encodes the write-up + removal as separate tasks where
   "remove findOpenPeriod / ACTIVE_PERIOD_ALREADY_EXISTS" depends on "inventory task complete and
   documented in this design.md". Since the inventory is already in this file, the tasks phase may
   encode the removal as post-inventory with this document as the satisfying artifact.

2. **Constant addition (`FISCAL_PERIOD_MONTH_EXISTS`) before service usage**. The
   `errors.ts` update is an atomic mechanical task that precedes the service refactor. Separate
   RED/GREEN pairs may be parallel, but the constant must import cleanly before the service test
   references it.

3. **Repository widening before service SHARE refactor**. `countDraftDocuments` must return 5 keys
   before `validateCanClose` can consume them. TDD order: RED on repo T10-style tests with 5-key
   assertions → GREEN repository change → RED on service `validateCanClose` test → GREEN service
   refactor (including the `getSummary` inline-to-shared rewiring).

4. **Breaking-payload commit atomicity**. The `close()` throw payload update MUST land in the same
   commit as the 4 test-file updates listed in A3, because tests using `toEqual` (A3 item 5) will
   hard-fail the moment the repo returns 5 keys instead of 3. Cannot be staggered.

5. **Service `create()` refactor ordering**:
   - Add `findByYearAndMonth` to repo (RED/GREEN).
   - Refactor `create()` to use it + derive month + P2002 mapping (RED/GREEN — includes deletion of
     `findByYear` guard call AND deletion of `findOpenPeriod` guard call).
   - Delete `findOpenPeriod` method + `ACTIVE_PERIOD_ALREADY_EXISTS` constant (mechanical cleanup
     task, depends on A2 inventory = this doc).

6. **Summary widening in lockstep with service refactor**. The `MonthlyCloseSummary.drafts` shape
   widens when `validateCanClose` replaces inline `countByStatus` in `getSummary`. The type change,
   the service change, and the UI `MonthlyClosePanel` adjustments (listed in B4) ship together —
   otherwise the React component's local `PeriodSummary` type narrows the API response and throws
   at runtime on `summary.drafts.sales` being undefined.

---

## Phase D — Test strategy

### D1. The 7 multiplicity scenarios (REQ-8)

Each test is a SEPARATE `it()` block. Fixture strategy: seed ONE draft record of the target entity
type, POSTED records of the other 4 (or no other rows). No parametrization. Suggested file:
`features/monthly-close/__tests__/monthly-close.service.multiplicity.test.ts` for F-03 tests (unit
level, mock `countDraftDocuments`), and
`features/fiscal-periods/__tests__/fiscal-periods.service.multiplicity.test.ts` for F-01/F-02 tests
(unit level, mock repo).

1. **"creates second period in same year"** (F-01, REQ-1 Scenario 1.1)
   - Unit test in `fiscal-periods.service.multiplicity.test.ts`.
   - Mock `findByYearAndMonth(2026, 2)` → null. Mock `repo.create` → new period.
   - Assert: no throw, returns the created period.

2. **"creates period with another OPEN existing"** (F-02, REQ-2 Scenario 2.1)
   - Same file; no mock for `findOpenPeriod` (method no longer exists after refactor — its absence
     is the structural guarantee). Mock `findByYearAndMonth(2026, 2)` → null. Mock `repo.create` →
     new period.
   - Assert: no throw. Crucially, the test's service construction must use a mock `repo` that does
     NOT expose `findOpenPeriod`; if the refactor leaves the call in, the test fails with
     "findOpenPeriod is not a function".

3-7. **"throws PERIOD_HAS_DRAFT_ENTRIES when one DRAFT {Dispatch|Payment|JournalEntry|Sale|Purchase}
   exists"** (F-03, REQ-4 Scenarios 4.1-4.5)
   - Unit tests in `monthly-close.service.multiplicity.test.ts`. One test block per entity type.
   - Setup: mock `countDraftDocuments` to return `{ dispatches: 1, payments: 0, ... }` for test 3,
     and so on per entity.
   - Assert: `ValidationError(PERIOD_HAS_DRAFT_ENTRIES)` with `details` containing all 5 keys, only
     the target entity non-zero.
   - Each test ALSO asserts the user-facing message names the correct Spanish term(s)
     (`despacho(s)`, `pago(s)`, `asiento(s) de diario`, `venta(s)`, `compra(s)`).
   - Additional assertions (per REQ-4): period.status unchanged, no AuditLog emitted, draft row
     unchanged — these three are NOT unit-testable (they assert DB state). Mark as "covered at
     integration level" or fold into the existing `monthly-close.integration.test.ts` with one
     integration test per entity. **Recommendation**: the seven multiplicity tests SHIP at the unit
     level (REQ-8 mandate) and the 3 side-effect assertions ship as 5 additional integration tests
     (one per entity). REQ-8's 7-block mandate is satisfied by the unit suite; integration gets its
     own block names but may parametrize at its discretion since REQ-8 is scoped to "the test file
     for this change" (unit file).

### D2. SHARE contract test (REQ-5 Scenario 5.3)

**This test is MANDATORY regardless of SHARE vs SPLIT** per Spec A REQ-5 — if SPLIT, required to
catch drift; if SHARE, required to catch regressions that re-split the paths.

Test location: `features/monthly-close/__tests__/monthly-close.service.share-contract.test.ts`.

Test shape (one `it()` block):
```ts
it("getSummary and close report identical draft counts for the same period state", async () => {
  const repo = buildRepoMock();
  const periodsService = buildPeriodsServiceMock();
  // Seed the SAME 5-key draft result for both method invocations.
  vi.mocked(repo.countDraftDocuments).mockResolvedValue({
    dispatches: 1, payments: 2, journalEntries: 3, sales: 4, purchases: 5,
  });
  vi.mocked(repo.countByStatus).mockResolvedValue(0);
  // ...

  const service = new MonthlyCloseService(repo, periodsService);

  const summary = await service.getSummary("org-1", "period-1");
  let closeDetails: Record<string, number> = {};
  try {
    await service.close({ organizationId: "org-1", periodId: "period-1", userId: "u" });
  } catch (err) {
    closeDetails = (err as ValidationError).details as Record<string, number>;
  }

  // Same fixture → same counts → no drift.
  expect(summary.drafts).toEqual({
    dispatches: closeDetails.dispatches,
    payments:   closeDetails.payments,
    journalEntries: closeDetails.journalEntries,
    sales:      closeDetails.sales,
    purchases:  closeDetails.purchases,
  });
});
```

This test would have caught F-03 at the commit that introduced T15's Sale/Purchase locking.

### D3. Integration vs unit split

- **Unit tests** cover: all 7 multiplicity scenarios (REQ-8), the SHARE contract test (REQ-5), P2002
  mapping in `create()` (REQ-3 Scenario 3.2 — throw-and-catch in the service is unit-testable via
  stubbed `repo.create` rejection), month-name es-BO formatting in the error message (REQ-3
  Scenario 3.1).
- **Integration tests** (touching the real DB) cover: REQ-4 side effects (period.status unchanged,
  DRAFT row unchanged, no AuditLog STATUS_CHANGE) — 5 integration test blocks, one per entity. These
  extend `monthly-close.integration.test.ts` with a new describe block.
- **Route handler tests** (existing `app/api/.../monthly-close/__tests__/route.test.ts`) get the
  payload-shape update listed in A3 item 4; optionally strengthen the assertion to include `sales:
  0, purchases: 0`.

### D4. Spec-alignment test for summary shape (REQ-6)

Add a type-level assertion in `features/monthly-close/__tests__/monthly-close.types.test.ts`:
```ts
expectTypeOf<MonthlyCloseSummary["drafts"]>().toEqualTypeOf<{
  dispatches: number;
  payments: number;
  journalEntries: number;
  sales: number;
  purchases: number;
}>();
```
This compiles only after B4 widens the type. RED-before-GREEN.

---

## Risks

- **`MonthlyClosePanel` runtime crash if type widens before UI update**: mitigated by the Phase C
  ordering — the type change, service change, and UI component update ship in the same commit (see
  Phase C item 6).
- **Test fixtures using `toEqual` on 3-key shape**: A3 item 5 identifies three repository-test
  assertions that hard-fail on shape change. Mitigated by updating those assertions in the same
  commit as the repository change (Phase C item 4).
- **Month-name locale drift**: if `MONTH_NAMES_ES` is ever extracted into a shared helper and
  reused elsewhere, future changes could subtly alter the es-BO string and break Scenario 3.1 test
  assertion on `"enero"`. Mitigation: keep the constant scope-local to `fiscal-periods.service.ts`;
  Scenario 3.1 test asserts on the literal Spanish month name to catch any drift.
- **P2002 target-index name collision with Prisma version changes**: the index name is hard-coded
  as `fiscal_periods_organizationId_year_month_key`. Prisma generated this name — a future rename
  or migration refactor would break the catch. Mitigation: a single test (REQ-3 Scenario 3.2) that
  simulates the P2002 with this exact target name verifies the mapping. If Prisma ever renames, the
  test fails loudly.
- **`findByYear` kept-but-unused**: lint tools may flag the method. Mitigation: not a runtime risk;
  if a future cleanup removes it, the F-01 fix is not affected (service uses
  `findByYearAndMonth`). `findByYear` is documented as "no production callers — safe to remove in a
  future cleanup" but retention decision is deferred.
- **Breaking payload shape vs not-yet-reviewed future external consumers**: the policy explicitly
  states it will be revisited if external integrations surface before apply. A3 confirmed zero
  today; reassess at apply-phase start.

## Open questions

None — the inventory resolved all three questions from the proposal:

1. ~~New error code name~~ → `FISCAL_PERIOD_MONTH_EXISTS` (resolved in Spec A Error Code Registry).
2. ~~Should `getSummary` expose Sale/Purchase drafts~~ → YES, REQ-6 mandates it (resolved in Spec A).
3. ~~Retire `ACTIVE_PERIOD_ALREADY_EXISTS` and `findOpenPeriod` now or later~~ → NOW, A1/A2
   inventories cleared the gate (resolved in this design).
