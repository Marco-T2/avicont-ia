# Spec — fiscal-period-monthly-create

**Change**: fiscal-period-monthly-create
**Artifact type**: Spec A — New capability
**Date**: 2026-04-21
**Status**: Approved

---

## Purpose

Repair three functional defects introduced by the `cierre-periodo` change that make the monthly fiscal
period model unusable in production. The defects are silent data corruption (F-03), a broken
creation invariant (F-01), and a guard that directly contradicts the monthly model's core design
decision (F-02). Evidence: `openspec/changes/monthly-close-ui-reconciliation/residual-debt-audit.md`
findings F-01, F-02, F-03.

---

## Scope

This spec governs:
- `FiscalPeriodsService.create` — month-scoped uniqueness and removal of the single-OPEN guard.
- `MonthlyCloseRepository.countDraftDocuments` — extension to 5 entities.
- `MonthlyCloseService.close` — draft check, error payload, user-facing message.
- `MonthlyCloseService.getSummary` — coherence requirement with `close()`.
- `FiscalPeriodsRepository.findOpenPeriod` / `ACTIVE_PERIOD_ALREADY_EXISTS` — inventory-gated retirement.

This spec does NOT govern: schema migrations (schema is correct since `cierre-periodo` Phase 1),
UI reconciliation, RBAC changes, or any finding scoped to `monthly-close-ui-reconciliation`.

---

## Requirements

---

### REQ-1 — Multi-period-per-year creation

The system MUST allow creating multiple `FiscalPeriod` records for the same `(organizationId, year)`
as long as each record has a distinct `month` value.

**Rationale**: The `cierre-periodo` change migrated the schema to `@@unique([organizationId, year, month])`
precisely to support one period per calendar month. The service guard in `create()` still calls
`findByYear` — which matches ANY period in that year — blocking month 2 through 12. The schema change
is dead weight until the service is corrected. Evidence: `fiscal-periods.service.ts:48`,
`fiscal-periods.repository.ts:24-29`.

#### Scenarios

**Scenario 1.1 — Creates second period in same year (F-01 multiplicity test)**

```
GIVEN an organization with one FiscalPeriod (year=2026, month=1, status=OPEN)
WHEN FiscalPeriodsService.create is called with startDate in February 2026 (year=2026, month=2)
THEN the call succeeds
AND a new FiscalPeriod record (year=2026, month=2) is persisted
AND no ConflictError with code FISCAL_PERIOD_YEAR_EXISTS is thrown
```

**Scenario 1.2 — Creates third period in same year**

```
GIVEN an organization with FiscalPeriod records for (year=2026, month=1) and (year=2026, month=2)
WHEN FiscalPeriodsService.create is called with startDate in March 2026 (year=2026, month=3)
THEN the call succeeds
AND a new FiscalPeriod record (year=2026, month=3) is persisted
```

**Scenario 1.3 — Periods for different years are independent**

```
GIVEN an organization with one FiscalPeriod (year=2025, month=12)
WHEN FiscalPeriodsService.create is called with startDate in January 2026 (year=2026, month=1)
THEN the call succeeds
AND the new FiscalPeriod record (year=2026, month=1) is persisted
```

---

### REQ-2 — Parallel OPEN periods allowed

The system MUST allow creating a new `FiscalPeriod` for any `(organizationId, year, month)` tuple
regardless of how many OPEN periods the organization already has.

**Rationale**: The `cierre-periodo` proposal explicitly states: "Se permiten múltiples FiscalPeriod
OPEN por organización dentro del mismo año (uno por mes no cerrado)." The `findOpenPeriod` guard
in `create()` directly contradicts this. An organization that keeps January OPEN while opening
February — a normal accounting pattern — is blocked. Evidence: `fiscal-periods.service.ts:56-60`,
`fiscal-periods.repository.ts:32-37`.

#### Scenarios

**Scenario 2.1 — Creates period with another OPEN existing (F-02 multiplicity test)**

```
GIVEN an organization with one FiscalPeriod (year=2026, month=1, status=OPEN)
WHEN FiscalPeriodsService.create is called with startDate in February 2026
THEN the call succeeds
AND no ConflictError with code ACTIVE_PERIOD_ALREADY_EXISTS is thrown
AND the organization now has two FiscalPeriod records, both with status=OPEN
```

**Scenario 2.2 — Creates period with two OPEN periods existing**

```
GIVEN an organization with FiscalPeriod records for month=1 (OPEN) and month=2 (OPEN)
WHEN FiscalPeriodsService.create is called for month=3
THEN the call succeeds
```

**Scenario 2.3 — Creates period with a CLOSED period existing**

```
GIVEN an organization with one FiscalPeriod (year=2026, month=1, status=CLOSED)
WHEN FiscalPeriodsService.create is called with startDate in February 2026
THEN the call succeeds
AND the new period is created with status=OPEN
```

---

### REQ-3 — Month uniqueness enforced

The system MUST reject the creation of a `FiscalPeriod` when a record already exists for the same
`(organizationId, year, month)` tuple, surfacing the conflict as `ConflictError(FISCAL_PERIOD_MONTH_EXISTS)`.

The service MUST catch Prisma error code `P2002` on the unique index `organizationId_year_month` and
map it to this error — a raw `PrismaClientKnownRequestError` MUST NOT propagate to callers.

The user-facing error message MUST identify the conflicting year and month in human-readable form,
using the Spanish month name (es-BO locale) — e.g., "Ya existe un período para enero de 2026".

**Rationale**: Pre-checking uniqueness via `findByYearAndMonth` before `repo.create` covers the common
case, but a race condition between two concurrent requests can cause the DB insert to fail with `P2002`
even if the pre-check passed. The service MUST wrap `repo.create` in a try/catch that converts `P2002`
to the domain error. The error code is `FISCAL_PERIOD_MONTH_EXISTS` (not `FISCAL_PERIOD_YEAR_EXISTS`,
which is a misleading name for month-level conflicts and is reserved for a future `FiscalYear`
duplicate scenario).

#### Scenarios

**Scenario 3.1 — Duplicate (year, month) fails with FISCAL_PERIOD_MONTH_EXISTS**

```
GIVEN an organization with one FiscalPeriod (year=2026, month=3, status=OPEN)
WHEN FiscalPeriodsService.create is called with startDate in March 2026 (year=2026, month=3)
THEN a ConflictError is thrown with code FISCAL_PERIOD_MONTH_EXISTS
AND the error message contains "marzo" and "2026" in human-readable Spanish
AND no new FiscalPeriod record is persisted
```

**Scenario 3.2 — P2002 race is caught and mapped (service wraps repo.create)**

```
GIVEN a Prisma P2002 error on organizationId_year_month is thrown by repo.create (simulated)
WHEN FiscalPeriodsService.create is called
THEN a ConflictError with code FISCAL_PERIOD_MONTH_EXISTS is thrown
AND no raw PrismaClientKnownRequestError propagates to the caller
```

**Scenario 3.3 — Different month in same year is NOT a conflict**

```
GIVEN an organization with FiscalPeriod (year=2026, month=1)
WHEN FiscalPeriodsService.create is called with startDate in February 2026 (month=2)
THEN no ConflictError is thrown (distinct month — not a duplicate)
```

**Scenario 3.4 — Same month in different year is NOT a conflict**

```
GIVEN an organization with FiscalPeriod (year=2025, month=6)
WHEN FiscalPeriodsService.create is called with startDate in June 2026 (year=2026, month=6)
THEN no ConflictError is thrown (distinct year — not a duplicate)
```

**Scenario 3.5 — Different organization sharing same (year, month) is NOT a conflict**

```
GIVEN organizationA has FiscalPeriod (year=2026, month=1)
WHEN organizationB calls FiscalPeriodsService.create with startDate in January 2026
THEN the call succeeds (unique constraint is scoped per organization)
```

---

### REQ-4 — Draft check covers all 5 locked entities

`MonthlyCloseService.close` MUST reject with `ValidationError(PERIOD_HAS_DRAFT_ENTRIES)` when ANY
of the following have DRAFT status rows belonging to the period: `Dispatch`, `Payment`, `JournalEntry`,
`Sale`, `Purchase`.

`MonthlyCloseRepository.countDraftDocuments` return type MUST be:
```ts
{ dispatches: number; payments: number; journalEntries: number; sales: number; purchases: number }
```
All 5 keys are required. Missing keys are a contract violation.

`ValidationError(PERIOD_HAS_DRAFT_ENTRIES).details` MUST carry all 5 counts in every error response,
including counts that are zero. A consumer MUST NOT need to handle the case where `details.sales` or
`details.purchases` are absent.

The user-facing message MUST name each entity type with a non-zero count using correct Spanish
terminology: despacho(s), pago(s), asiento(s) de diario, venta(s), compra(s).

**Rationale**: `lockSales` and `lockPurchases` in `close()` filter by `status = 'POSTED'`, meaning
DRAFT Sale/Purchase rows are silently skipped during the lock cascade. A period can close with
DRAFT sales or purchases inside it — those DRAFTs are not locked, not audited, and not counted.
This is exactly the corruption mode `cierre-periodo` was designed to prevent. Evidence: F-03,
`monthly-close.repository.ts:44-63` (countDraftDocuments), `monthly-close.service.ts:114-132`
(totalDrafts sums only 3 entities).

#### Scenarios

Each scenario below targets a separate `it()` test. No parametrization — five independent test blocks.

**Scenario 4.1 — Closing with one DRAFT Dispatch throws PERIOD_HAS_DRAFT_ENTRIES (F-03 Dispatch)**

```
GIVEN a period with status=OPEN
AND exactly one Dispatch with status=DRAFT in that period
AND no other DRAFT documents (Payment, JournalEntry, Sale, Purchase are all POSTED or absent)
WHEN close() is called for that period
THEN a ValidationError with code PERIOD_HAS_DRAFT_ENTRIES is thrown
AND error.details.dispatches = 1
AND error.details.payments = 0
AND error.details.journalEntries = 0
AND error.details.sales = 0
AND error.details.purchases = 0
AND period.status remains OPEN after the throw
AND the Dispatch status remains DRAFT after the throw
AND no AuditLog row with action=STATUS_CHANGE for this period was emitted
```

**Scenario 4.2 — Closing with one DRAFT Payment throws PERIOD_HAS_DRAFT_ENTRIES (F-03 Payment)**

```
GIVEN a period with status=OPEN
AND exactly one Payment with status=DRAFT in that period
AND no other DRAFT documents (Dispatch, JournalEntry, Sale, Purchase are all POSTED or absent)
WHEN close() is called for that period
THEN a ValidationError with code PERIOD_HAS_DRAFT_ENTRIES is thrown
AND error.details.dispatches = 0
AND error.details.payments = 1
AND error.details.journalEntries = 0
AND error.details.sales = 0
AND error.details.purchases = 0
AND period.status remains OPEN after the throw
AND the Payment status remains DRAFT after the throw
AND no AuditLog row with action=STATUS_CHANGE for this period was emitted
```

**Scenario 4.3 — Closing with one DRAFT JournalEntry throws PERIOD_HAS_DRAFT_ENTRIES (F-03 JournalEntry)**

```
GIVEN a period with status=OPEN
AND exactly one JournalEntry with status=DRAFT in that period
AND no other DRAFT documents (Dispatch, Payment, Sale, Purchase are all POSTED or absent)
WHEN close() is called for that period
THEN a ValidationError with code PERIOD_HAS_DRAFT_ENTRIES is thrown
AND error.details.dispatches = 0
AND error.details.payments = 0
AND error.details.journalEntries = 1
AND error.details.sales = 0
AND error.details.purchases = 0
AND period.status remains OPEN after the throw
AND the JournalEntry status remains DRAFT after the throw
AND no AuditLog row with action=STATUS_CHANGE for this period was emitted
```

**Scenario 4.4 — Closing with one DRAFT Sale throws PERIOD_HAS_DRAFT_ENTRIES (F-03 Sale — new)**

```
GIVEN a period with status=OPEN
AND exactly one Sale with status=DRAFT in that period
AND no other DRAFT documents (Dispatch, Payment, JournalEntry, Purchase are all POSTED or absent)
WHEN close() is called for that period
THEN a ValidationError with code PERIOD_HAS_DRAFT_ENTRIES is thrown
AND error.details.dispatches = 0
AND error.details.payments = 0
AND error.details.journalEntries = 0
AND error.details.sales = 1
AND error.details.purchases = 0
AND period.status remains OPEN after the throw
AND the Sale status remains DRAFT after the throw
AND no AuditLog row with action=STATUS_CHANGE for this period was emitted
```

**Scenario 4.5 — Closing with one DRAFT Purchase throws PERIOD_HAS_DRAFT_ENTRIES (F-03 Purchase — new)**

```
GIVEN a period with status=OPEN
AND exactly one Purchase with status=DRAFT in that period
AND no other DRAFT documents (Dispatch, Payment, JournalEntry, Sale are all POSTED or absent)
WHEN close() is called for that period
THEN a ValidationError with code PERIOD_HAS_DRAFT_ENTRIES is thrown
AND error.details.dispatches = 0
AND error.details.payments = 0
AND error.details.journalEntries = 0
AND error.details.sales = 0
AND error.details.purchases = 1
AND period.status remains OPEN after the throw
AND the Purchase status remains DRAFT after the throw
AND no AuditLog row with action=STATUS_CHANGE for this period was emitted
```

**Scenario 4.6 — All 5 entity types DRAFT together**

```
GIVEN a period with one DRAFT Dispatch, one DRAFT Payment, one DRAFT JournalEntry,
      one DRAFT Sale, and one DRAFT Purchase
WHEN close() is called
THEN a ValidationError with code PERIOD_HAS_DRAFT_ENTRIES is thrown
AND error.details = { dispatches: 1, payments: 1, journalEntries: 1, sales: 1, purchases: 1 }
AND the user-facing message names all 5 entity types
```

**Scenario 4.7 — All documents POSTED — draft check passes**

```
GIVEN a period where all Dispatch, Payment, JournalEntry, Sale, Purchase records are POSTED or LOCKED
WHEN close() is called (assuming balance check and transaction succeed)
THEN no ValidationError with code PERIOD_HAS_DRAFT_ENTRIES is thrown
AND close proceeds to the balance check step
```

---

### REQ-5 — Summary and close read the same source of truth

`MonthlyCloseService.getSummary()` and `MonthlyCloseService.close()` MUST NOT diverge in what they
count as "draft documents blocking close". The set of entities checked for DRAFT status MUST be
identical across both methods.

**Spec-level constraint on design**: Design phase MUST determine whether `close()` and `getSummary()`
can share a common method (e.g. `validateCanClose()` or `countDraftDocuments()`) that both invoke.
If they CAN share, the design MUST prescribe that shared method. If they CANNOT share, the design
MUST document the specific reason they must be split; the spec then requires a test that passes both
methods identical fixtures and asserts identical output for the draft counts.

This is a spec-level invariant: the design is not free to leave this as an implementation detail.

**Rationale**: F-03's root cause was that `countDraftDocuments` (called by `close()`) and the inline
`countByStatus` calls (in `getSummary()`) drifted: the former counted 3 entities, the latter also
counted 3 — but neither counted Sale or Purchase. If the two paths had shared a single method, adding
Sale/Purchase to one would automatically add it to both. The duplication is the structural cause of
the bug class, not a one-time oversight. Evidence: `monthly-close.service.ts:39-80` vs.
`monthly-close.service.ts:114-132`.

#### Scenarios

**Scenario 5.1 — getSummary and close report the same draft counts for a period with DRAFT Sale**

```
GIVEN a period with exactly one Sale in status=DRAFT and no other DRAFT documents
WHEN getSummary() is called for that period
THEN summary.drafts.sales = 1
WHEN close() is called for that period
THEN ValidationError(PERIOD_HAS_DRAFT_ENTRIES) is thrown with error.details.sales = 1
AND both counts come from the same underlying query (verified by the shared method contract)
```

**Scenario 5.2 — getSummary and close report the same draft counts for a period with DRAFT Purchase**

```
GIVEN a period with exactly one Purchase in status=DRAFT and no other DRAFT documents
WHEN getSummary() is called for that period
THEN summary.drafts.purchases = 1
WHEN close() is called for that period
THEN ValidationError(PERIOD_HAS_DRAFT_ENTRIES) is thrown with error.details.purchases = 1
```

**Scenario 5.3 — Same-fixture coherence test (mandatory if design splits the paths)**

```
GIVEN both getSummary() and close() are passed identical test fixtures representing a period
      with N DRAFT documents across all 5 entity types
WHEN both methods are invoked
THEN the draft counts reported by getSummary().drafts are numerically identical
     to the counts in the ValidationError(PERIOD_HAS_DRAFT_ENTRIES).details thrown by close()
```

---

### REQ-6 — Summary reports DRAFT counts for all 5 entities

`MonthlyCloseSummary.drafts` return shape MUST be:
```ts
{ dispatches: number; payments: number; journalEntries: number; sales: number; purchases: number }
```

All 5 keys are required. The UI pre-close panel receives this shape; whatever count it displays MUST
be the same count `close()` would enforce — enforced by REQ-5.

**Rationale**: The current `getSummary()` returns `drafts: { dispatches, payments, journalEntries }`
only. If a user sees zero drafts in the pre-close summary but has DRAFT Sale or Purchase records,
they close the period believing it is clean — then the period closes with DRAFT Sales/Purchases
inside. The summary is a false signal. Evidence: `monthly-close.service.ts:67-70`.

#### Scenarios

**Scenario 6.1 — Summary includes DRAFT Sale count**

```
GIVEN a period with exactly 2 Sales in status=DRAFT and no other DRAFT documents
WHEN getSummary() is called
THEN summary.drafts.sales = 2
AND summary.drafts.purchases = 0
AND summary.drafts.dispatches = 0
AND summary.drafts.payments = 0
AND summary.drafts.journalEntries = 0
```

**Scenario 6.2 — Summary includes DRAFT Purchase count**

```
GIVEN a period with exactly 3 Purchases in status=DRAFT and no other DRAFT documents
WHEN getSummary() is called
THEN summary.drafts.purchases = 3
AND summary.drafts.sales = 0
```

**Scenario 6.3 — Summary includes all 5 draft counts when no DRAFTs exist**

```
GIVEN a period where all documents are POSTED
WHEN getSummary() is called
THEN summary.drafts = { dispatches: 0, payments: 0, journalEntries: 0, sales: 0, purchases: 0 }
AND all 5 keys are present in the response object
```

**Scenario 6.4 — Summary.drafts shape has all 5 keys regardless of entity presence**

```
GIVEN a period with no documents at all
WHEN getSummary() is called
THEN summary.drafts contains the keys dispatches, payments, journalEntries, sales, purchases
AND all values are 0
```

---

### REQ-7 — Retirement of findOpenPeriod and ACTIVE_PERIOD_ALREADY_EXISTS is inventory-gated

Removal of `FiscalPeriodsRepository.findOpenPeriod` and the constant `ACTIVE_PERIOD_ALREADY_EXISTS`
MUST NOT proceed without a complete caller/consumer inventory executed as a preceding task.

The inventory MUST cover:
- **findOpenPeriod callers**: all `.ts`/`.tsx` production files that call or import `findOpenPeriod`.
- **ACTIVE_PERIOD_ALREADY_EXISTS consumers**: all files (tests, UI error mappers, API client code,
  shared error registry) that reference or import `ACTIVE_PERIOD_ALREADY_EXISTS`.

If the inventory finds legitimate callers beyond the `create()` guard being removed (e.g., an "active
period" dashboard widget, a different service that queries the open period), the spec MUST be extended
with a new REQ before removal proceeds. Silent removal with broken callers is prohibited.

If the inventory finds zero legitimate callers, tasks phase encodes the removal as a task that
follows the inventory task (dependency gate).

**Rationale**: The constant is exported from `features/shared/errors.ts`. Any consumer that
references it by name would get a compile error on removal — but any consumer that hard-codes the
string `"ACTIVE_PERIOD_ALREADY_EXISTS"` or reads it from a JSON error response would silently break.
Inventory before removal eliminates both risks.

#### Scenarios

**Scenario 7.1 — Inventory task gates removal task (process requirement)**

```
GIVEN the tasks list for this change
WHEN tasks are ordered by dependency
THEN the "caller inventory of findOpenPeriod and ACTIVE_PERIOD_ALREADY_EXISTS" task
     appears BEFORE the "remove findOpenPeriod and ACTIVE_PERIOD_ALREADY_EXISTS" task
AND the removal task has an explicit dependency on the inventory task's output
```

**Scenario 7.2 — No legitimate callers found: removal proceeds**

```
GIVEN the inventory finds no callers of findOpenPeriod beyond the create() guard
AND finds no consumers of ACTIVE_PERIOD_ALREADY_EXISTS beyond the removed guard
WHEN the removal task is executed
THEN findOpenPeriod is deleted from FiscalPeriodsRepository
AND ACTIVE_PERIOD_ALREADY_EXISTS is removed from features/shared/errors.ts
AND no compile errors or test failures result from the removal
```

**Scenario 7.3 — Legitimate callers found: spec is extended before removal**

```
GIVEN the inventory finds at least one legitimate caller of findOpenPeriod or consumer
      of ACTIVE_PERIOD_ALREADY_EXISTS beyond the create() guard being removed
WHEN this finding is reported
THEN removal does NOT proceed in this change
AND a new REQ is drafted to address the caller adaptation or deprecation path
AND the removal task is marked as blocked pending the new REQ
```

---

### REQ-8 — Multiplicity test coverage is mandatory

This change MUST ship with all 7 tests below as SEPARATE `it()` blocks. No parametrization, no
shared `it.each`, no table-driven shortcuts. Each test is an independent test block with its own
setup, action, and assertion:

1. **"creates second period in same year"** (REQ-1, Scenario 1.1)
2. **"creates period with another OPEN existing"** (REQ-2, Scenario 2.1)
3. **"throws PERIOD_HAS_DRAFT_ENTRIES when one DRAFT Dispatch exists"** (REQ-4, Scenario 4.1)
4. **"throws PERIOD_HAS_DRAFT_ENTRIES when one DRAFT Payment exists"** (REQ-4, Scenario 4.2)
5. **"throws PERIOD_HAS_DRAFT_ENTRIES when one DRAFT JournalEntry exists"** (REQ-4, Scenario 4.3)
6. **"throws PERIOD_HAS_DRAFT_ENTRIES when one DRAFT Sale exists"** (REQ-4, Scenario 4.4)
7. **"throws PERIOD_HAS_DRAFT_ENTRIES when one DRAFT Purchase exists"** (REQ-4, Scenario 4.5)

**Rationale**: Fixtures with clean state (zero pre-existing records) were the structural blind spot
that let F-01, F-02, and F-03 escape 2650 tests. A parametrized test over the 5 entity types would
still pass with a single shared mock — hiding whether the implementation actually handles each entity
independently. Five separate `it()` blocks force five independent setups that must each produce the
correct result in isolation. Evidence: all 3 findings escaped because no test seeded the non-empty
state the bug required to trigger.

#### Scenarios

**Scenario 8.1 — Test suite has exactly 7 named it() blocks for multiplicity (meta)**

```
GIVEN the test file for this change
WHEN its test block names are enumerated
THEN all 7 names listed above are present as independent it() calls
AND none of them is wrapped in an it.each or describe.each that parametrizes the entity type
```

---

## Error Code Registry (this change)

| Code | HTTP | Type | Meaning |
|---|---|---|---|
| `FISCAL_PERIOD_MONTH_EXISTS` | 409 | ConflictError | A FiscalPeriod already exists for this (organizationId, year, month) |

Note: `FISCAL_PERIOD_YEAR_EXISTS` is NOT reused for month-level conflicts. That name is reserved for
a future `FiscalYear` entity duplicate scenario. Using it for monthly conflicts would embed a false
cardinality claim in the error code.

---

## Breaking contract: PERIOD_HAS_DRAFT_ENTRIES.details

Adding `sales` and `purchases` to the `details` payload is a breaking change for any consumer that
iterates `Object.keys(details)` or asserts `Object.keys(details).length === 3`.

**Policy**: Breaking change is acceptable. The project is internal with no production data at risk.
Design phase confirms via consumer inventory. If external integrations surface, this decision is
revisited before the apply phase begins.

Design phase MUST inventory all consumers of `PERIOD_HAS_DRAFT_ENTRIES.details`:
- Test files asserting on the details shape.
- UI error mappers that destructure details.
- API client code or TypeScript types that define the details shape.

---

## Design principles

### Multiplicity test principle

When a schema change relaxes a uniqueness or cardinality constraint, the test suite MUST include at
least one case where the new multiplicity is exercised. Clean-state fixtures can mask invariant bugs
in guards that existed before the relaxation. A guard that blocked the old behavior may still be
present in the service layer, silently overriding what the schema now permits — and a clean-state
test will never trigger it.

Evidence: F-01 and F-02 escaped 2650 tests because no test seeded TWO periods for the same year.
Every test started from an empty database. The `findByYear` guard was never exercised with the state
it was supposed to allow.

### Single source of truth principle

When two methods present the same property (e.g., "is this period closable?"), that property MUST be
computed once and consumed twice — not computed twice. Duplicate logic for the same fact will drift:
the first time a new entity type is added to the scope of the fact, it will be updated in one method
and forgotten in the other.

F-03 is the canonical cautionary tale: `countDraftDocuments` (called by `close()`) and the inline
`countByStatus` calls (in `getSummary()`) both expressed "how many DRAFT documents exist in this
period" — as two independent implementations. T15 added Sale/Purchase locking, which updated the
lock cascade but not `countDraftDocuments`. Because the logic was duplicated, the update was partial.
Because the update was partial, F-03 existed silently for the lifetime of `cierre-periodo`.
