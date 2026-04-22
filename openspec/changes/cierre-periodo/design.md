# Design: cierre-periodo

> HOW we will build what the spec describes.
> For WHAT must hold, see `specs/monthly-period-close/spec.md` and `specs/audit-log/spec.md`.

---

## Technical approach

`MonthlyCloseService.close` becomes the single canonical entry point for sealing a monthly accounting period. The service orchestrates a **single Prisma `$transaction`** that: (a) sets Postgres session variables (`app.current_user_id`, `app.audit_justification`, `app.correlation_id`) via an extended `setAuditContext`, (b) runs pre-flight validations (idempotency, DRAFT presence, DEBE=HABER via a SQL aggregation), (c) executes mass `UPDATE` locks on `Dispatch`, `Payment`, `JournalEntry`, `Sale`, `Purchase` (POSTED → LOCKED), and (d) updates the `FiscalPeriod` row itself (status, `closedAt`, `closedBy`). A new trigger on `fiscal_periods` and a new trigger on `purchases` (parity with `sales`) emit one audit row per mutation, all stamped with the same `correlationId`. The legacy `FiscalPeriodsService.close` + its `PATCH /periods/[periodId]` route are deleted in the final task; `RBAC` for the new endpoint is gated by a new, dedicated permission `period:close`.

---

## Data model changes

### `FiscalPeriod` (destructive — dev-only data)

```diff
 model FiscalPeriod {
   id             String             @id @default(cuid())
   organizationId String
   name           String
   year           Int
+  month          Int                // 1..12 — calendar month
   startDate      DateTime
   endDate        DateTime
   status         FiscalPeriodStatus @default(OPEN)
+  closedAt       DateTime?
+  closedBy       String?
   createdById    String
   createdAt      DateTime           @default(now())
   updatedAt      DateTime           @updatedAt
   organization   Organization       @relation(fields: [organizationId], references: [id])
+  closedByUser   User?              @relation("FiscalPeriodCloser", fields: [closedBy], references: [id])
   journalEntries JournalEntry[]
   balances       AccountBalance[]
   dispatches     Dispatch[]
   payments         Payment[]
   purchases        Purchase[]
   sales            Sale[]
   ivaPurchaseBooks IvaPurchaseBook[]
   ivaSalesBooks    IvaSalesBook[]

-  @@unique([organizationId, year])
+  @@unique([organizationId, year, month])
   @@index([organizationId, status])
   @@map("fiscal_periods")
 }
```

`User` model gets the symmetric relation:

```diff
 model User {
   ...
+  closedPeriods  FiscalPeriod[] @relation("FiscalPeriodCloser")
 }
```

**Constraint on `month`**: enforced at the **Zod/validation layer** (1..12 integer) and at the **migration layer** via a `CHECK` constraint (`month BETWEEN 1 AND 12`). Prisma does not express CHECK constraints in schema; we add it in raw SQL in the same migration.

### `AuditLog`

```diff
 model AuditLog {
   id              String   @id @default(cuid())
   organizationId  String
   entityType      String
   entityId        String
   action          String
   oldValues       Json?
   newValues       Json?
   changedById     String?
   justification   String?
+  correlationId   String?
   createdAt       DateTime @default(now())
   organization    Organization @relation(fields: [organizationId], references: [id])

   @@index([organizationId, entityType, entityId])
   @@index([organizationId, createdAt])
+  @@index([correlationId])
   @@map("audit_logs")
 }
```

**Entity-type+time index not added**: the existing `@@index([organizationId, entityType, entityId])` already covers the "group all rows for entity X" path. The new `@@index([correlationId])` covers the close-grouping path ("return everything that happened in this close"). Adding `[entityType, entityId, createdAt]` is out of scope; revisit if query plans show otherwise.

---

## Migration plan

### One migration, destructive header, three concerns

Filename: `prisma/migrations/<timestamp>_cierre_periodo/migration.sql`.

A new migration file is the correct choice (not editing `20260406010241_monthly_close_audit_trail`): that migration has already been applied to dev DBs, and Prisma tracks migration identity by filename — editing it would break `prisma migrate status`. The new migration piggybacks on the applied baseline and adds the delta.

**Header block**:

```sql
-- DESTRUCTIVE MIGRATION — cierre-periodo
-- This migration drops `fiscal_periods` and recreates it with the monthly shape.
-- All existing FiscalPeriod rows and cascaded data are LOST.
-- This is acceptable because:
--   • This codebase is in pre-production development.
--   • Dev DBs contain ~10 seed rows with no business meaning.
-- If a production DB ever reaches this migration with real data, HALT and
-- replan with a stepwise backfill. Confirm locally: `pg_dump` schema `public`
-- before `prisma migrate deploy` as an operational safety ritual.
```

**Three logical sections in the same file** (grouped, in order):

1. **Schema changes**:
   - `DROP TABLE fiscal_periods CASCADE;` (drops dependent `journal_entries`, `account_balances`, `dispatches`, `payments`, `purchases`, `sales`, `iva_*_books` references via CASCADE — acceptable only because dev data).
   - Recreate `fiscal_periods` with `month INT NOT NULL`, `closedAt TIMESTAMP(3) NULL`, `closedBy TEXT NULL`, and `UNIQUE (organizationId, year, month)`.
   - `CHECK (month BETWEEN 1 AND 12)`.
   - Re-add FK to `users(id)` for `closedBy` with `ON DELETE SET NULL`.
   - Recreate all FKs pointing at `fiscal_periods` (they were dropped by CASCADE).
   - `ALTER TABLE audit_logs ADD COLUMN "correlationId" TEXT NULL;`
   - `CREATE INDEX "audit_logs_correlationId_idx" ON audit_logs("correlationId");`

2. **Audit trigger function update** (idempotent `CREATE OR REPLACE`):
   - Extend `audit_trigger_fn()` to read `app.correlation_id` via `current_setting('app.correlation_id', true)` and include it in the `INSERT`.
   - Full function body redefined — no partial ALTER.

3. **New triggers**:
   - `CREATE TRIGGER audit_fiscal_periods AFTER UPDATE OR DELETE ON fiscal_periods FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();`
   - `CREATE TRIGGER audit_purchases AFTER UPDATE OR DELETE ON purchases FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();`

### Why one file, not two

The trigger function update and the new triggers depend on the schema change (the function inserts into `audit_logs` which now has `correlationId`; the new trigger on `fiscal_periods` only makes sense after the table is recreated). Splitting them invites ordering bugs. One atomic file, one `prisma migrate deploy` step, one rollback boundary.

### Reseed command (documented in migration comment)

```bash
pnpm prisma migrate reset --force && pnpm prisma:seed
```

Developers re-apply local seeds after the destructive step.

---

## Audit trigger redesign

### Extended `audit_trigger_fn()` (full replacement)

Behavioral change: **one extra session var read, one extra column written**. No change to DELETE/UPDATE/STATUS_CHANGE detection logic.

```sql
CREATE OR REPLACE FUNCTION audit_trigger_fn() RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_user_id TEXT;
  v_justification TEXT;
  v_correlation_id TEXT;   -- NEW
  v_org_id TEXT;
  v_old_json JSONB;
  v_new_json JSONB;
BEGIN
  v_user_id := current_setting('app.current_user_id', true);
  v_justification := current_setting('app.audit_justification', true);
  v_correlation_id := current_setting('app.correlation_id', true);  -- NEW; returns NULL if unset

  IF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_old_json := to_jsonb(OLD);
    v_new_json := NULL;
    v_org_id := OLD."organizationId";
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_action := 'STATUS_CHANGE';
    ELSE
      v_action := 'UPDATE';
    END IF;
    v_old_json := to_jsonb(OLD);
    v_new_json := to_jsonb(NEW);
    v_org_id := NEW."organizationId";
  END IF;

  INSERT INTO audit_logs (
    id, "organizationId", "entityType", "entityId", action,
    "oldValues", "newValues", "changedById", justification,
    "correlationId", "createdAt"                -- NEW column
  )
  VALUES (
    gen_random_uuid()::text, v_org_id, TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    v_action, v_old_json, v_new_json, v_user_id, v_justification,
    v_correlation_id,                            -- NEW value
    NOW()
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;
```

**Fail-safe stance**: if `setAuditContext` is never called (service bug), the function reads NULL for all three vars and inserts NULL — no exception raised. Tests catch this by asserting `correlationId IS NOT NULL` on rows emitted during `close()`.

### New triggers

```sql
CREATE TRIGGER audit_fiscal_periods
  AFTER UPDATE OR DELETE ON fiscal_periods
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_purchases
  AFTER UPDATE OR DELETE ON purchases
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
```

Neither table has a prior trigger, so `DROP TRIGGER IF EXISTS` is unnecessary but harmless if added.

---

## Service architecture

### Canonical path

**Keep the existing flat path `features/monthly-close/`** — no move under `features/accounting/`. Rationale: the current codebase has both flat (`features/fiscal-periods/`, `features/monthly-close/`) and nested (`features/accounting/iva-books/`) conventions. Moving is pure churn with zero payoff; consumers already import from `@/features/monthly-close/server`. The `features/fiscal-periods/` directory stays but loses its `close` method.

### File layout (after change)

```
features/monthly-close/
├── monthly-close.types.ts          # EDIT — CloseRequest, CloseResult, error shapes, month
├── monthly-close.service.ts        # EDIT — orchestration, correlationId, DEBE=HABER, Sale/Purchase
├── monthly-close.repository.ts     # EDIT — add balance aggregation, Sale/Purchase lock, update period with closedAt/closedBy
├── monthly-close.validation.ts     # NEW  — Zod schema for POST payload (periodId, optional justification)
├── server.ts                       # existing barrel — unchanged
├── index.ts                        # existing barrel — unchanged
└── __tests__/
    ├── monthly-close.service.test.ts        # NEW — unit, mocks repo
    ├── monthly-close.repository.test.ts     # NEW — integration, real Postgres
    ├── monthly-close.integration.test.ts    # NEW — end-to-end through $transaction, asserts trigger rows
    └── monthly-close.rbac.test.ts           # EDIT — existing RBAC page test updated to new permission
```

### Public API

```ts
export interface CloseRequest {
  organizationId: string;
  periodId: string;
  userId: string;
  justification?: string;  // optional at close; required only when editing LOCKED docs (separate flow)
}

export interface CloseResult {
  periodId: string;
  periodStatus: "CLOSED";
  closedAt: Date;
  correlationId: string;       // echoed back for UI audit-viewer link
  locked: {
    dispatches: number;
    payments: number;
    journalEntries: number;
    sales: number;       // NEW
    purchases: number;   // NEW
  };
}

export type CloseErrorCode =
  | "PERIOD_NOT_FOUND"
  | "PERIOD_ALREADY_CLOSED"
  | "PERIOD_HAS_DRAFT_ENTRIES"
  | "PERIOD_UNBALANCED"
  | "INSUFFICIENT_PERMISSION";

export class MonthlyCloseService {
  async close(input: CloseRequest): Promise<CloseResult>;
  async getSummary(organizationId: string, periodId: string): Promise<MonthlyCloseSummary>;
}
```

### Internal flow (inside `close()`)

```
1. Load period (throw PERIOD_NOT_FOUND / PERIOD_ALREADY_CLOSED)
2. Count drafts across Dispatch + Payment + JournalEntry (pre-tx; cheap)
   → throw PERIOD_HAS_DRAFTS with per-entity counts
3. correlationId = crypto.randomUUID()
4. prisma.$transaction(async (tx) => {
     setAuditContext(tx, userId, justification, correlationId)
     balance = repo.sumDebitCredit(tx, orgId, periodId)
     if (!balance.debit.eq(balance.credit)) throw PERIOD_UNBALANCED
     lockedDispatches = repo.lockDispatches(tx, ...)
     lockedPayments = repo.lockPayments(tx, ...)
     lockedJEs = repo.lockJournalEntries(tx, ...)
     lockedSales = repo.lockSales(tx, ...)           // NEW
     lockedPurchases = repo.lockPurchases(tx, ...)   // NEW
     closedPeriod = repo.closePeriod(tx, ..., userId)  // sets closedAt, closedBy
     return { ...locked, closedAt: closedPeriod.closedAt, correlationId }
   })
```

RBAC (`period:close`) is checked at the **route handler** (Next.js route using `requirePermission`), NOT inside the service. Services remain permission-agnostic per project convention.

---

## Transaction boundary strategy

### One `$transaction` — no nesting

All mutations (session vars set, balance aggregation read, 5 locks, period update) run inside **one** `prisma.$transaction(async (tx) => { ... })`. Nested `$transaction` calls are forbidden in this flow.

### Why nested transactions are forbidden here

With the `@prisma/adapter-pg` driver, a nested `$transaction` inside a callback either (a) creates a savepoint (Prisma's default when nesting is detected) or (b) acquires a fresh connection from the pool. Both break `SET LOCAL` semantics: `SET LOCAL` binds to the current transaction, and a nested TX operating on a different connection or savepoint scope will read NULL for `app.correlation_id`. The audit trigger would then emit rows with `correlationId = NULL` — silently breaking the correlation invariant. The test `all rows from a close share one correlationId` catches this, but the cleaner design is **a rule**: any helper called by `close()` MUST accept `tx` and reuse it, not open a new transaction.

### Isolation level

Default (`READ COMMITTED` on Postgres). Justification: the close operation holds write locks on rows it updates for the full TX duration, so no other writer can interleave. A concurrent READ of a half-locked period sees the OPEN state until commit — acceptable; the UI does not need strict snapshot isolation for this flow. `SERIALIZABLE` would add retry complexity for zero gain.

### Timeout

Explicit `timeout: 30_000` on `$transaction`. A period with thousands of documents should still close in seconds; 30s is generous enough to absorb trigger-row inserts without being infinite.

---

## DEBE = HABER check strategy

### Chosen: SQL aggregation (option A)

```sql
SELECT
  COALESCE(SUM(jl.debit),  0)::numeric(18,2) AS debit_total,
  COALESCE(SUM(jl.credit), 0)::numeric(18,2) AS credit_total
FROM journal_lines jl
JOIN journal_entries je ON je.id = jl."journalEntryId"
WHERE je."organizationId" = $1
  AND je."periodId"       = $2
  AND je.status            = 'POSTED';
```

Repository exposes:

```ts
async sumDebitCredit(tx, orgId, periodId):
  Promise<{ debit: Prisma.Decimal; credit: Prisma.Decimal }>;
```

Then in the service: `if (!debit.eq(credit)) throw PERIOD_UNBALANCED({ debit, credit, diff: debit.minus(credit).abs() })`.

### Why not app-side iteration (option B)

Iterating all `JournalLine` rows in Node, coercing to `Prisma.Decimal`, and summing in JS is correct but O(N) in memory and round-trip latency. A period with 5k lines means 5k rows shipped over the wire for a single scalar comparison. SQL `SUM` on `numeric(18,2)` is exact (Postgres uses arbitrary-precision `numeric`), not floating-point, so precision concerns do not apply. Option A is faster, simpler, and equivalently safe.

### Precision rule

- Comparison uses `Prisma.Decimal.eq`, NEVER `===` or `Number()` coercion.
- `JournalLine.debit` and `JournalLine.credit` are `Decimal(12, 2)` in schema — the SUM is cast to `numeric(18,2)` in the query to accommodate aggregation headroom (4 extra digits handles sums up to ~1e16).

### Empty-period behavior

`SUM` over zero rows returns NULL; `COALESCE(..., 0)` maps to `Decimal(0)`. `0.eq(0)` is true. Closing an empty period trivially passes.

---

## Correlation ID propagation

### Lifecycle

1. `MonthlyCloseService.close()` generates `const correlationId = crypto.randomUUID()` at the very top of the method, BEFORE entering `$transaction`.
2. Inside the TX, the FIRST statement is `setAuditContext(tx, userId, justification, correlationId)`.
3. `setAuditContext` issues three `SET LOCAL` statements:
   ```ts
   await tx.$executeRawUnsafe(`SET LOCAL app.current_user_id = '${escape(userId)}'`);
   if (justification) await tx.$executeRawUnsafe(`SET LOCAL app.audit_justification = '${escape(justification)}'`);
   if (correlationId) await tx.$executeRawUnsafe(`SET LOCAL app.correlation_id = '${escape(correlationId)}'`);
   ```
4. Every subsequent `UPDATE` fires the trigger; the trigger reads `app.correlation_id` via `current_setting('app.correlation_id', true)` and persists it.
5. At TX commit, `SET LOCAL` is automatically discarded — no session leakage.
6. The service returns `correlationId` in `CloseResult`.

### Extended `setAuditContext` signature

```diff
 export async function setAuditContext(
   tx: Prisma.TransactionClient,
   userId: string,
   justification?: string,
+  correlationId?: string,
 ): Promise<void>
```

Existing call sites (no 4th arg) are unaffected — `correlationId` is optional.

### Escaping

The current helper uses `.replace(/'/g, "''")` for SQL-literal escaping of user-supplied strings. `correlationId` comes from `crypto.randomUUID()` — a fixed-format hex+dash string with no quotes — so escaping is a formality, not a security gate. Still applied for uniformity.

---

## UI for `correlationId`

**Recommendation: internal diagnostic only.**

End users (accountants, admins) do NOT see the raw UUID. The close confirmation UI shows: "Período cerrado. 147 documentos bloqueados. Ver evento de auditoría →". The link opens a **Close Event viewer** page that queries `AuditLog WHERE correlationId = ?` and renders a timeline grouped by entity — the UUID is in the URL query string but is not displayed as text in the UI chrome.

**Reasoning**: UUIDs are unreadable, un-memorable, and trigger "support ticket with ID abc-def-123..." friction without aiding the accountant's actual task. A grouped timeline ("You closed period Enero 2026 on 21-Apr-2026 at 14:33; 12 sales locked, 8 purchases locked, 4 journal entries locked, period sealed") is the human-meaningful view. The correlationId remains essential as the database-level join key and for support/debugging diagnostics, but it stays out of the accountant's working vocabulary.

This decision affects scope: we do NOT add a "Buscar por Correlation ID" input field. The UI surface is one click from the close confirmation, one page to render the timeline.

---

## Deprecation path for legacy `FiscalPeriodsService.close`

### Tactic: hard delete in the final task, not gradual deprecation

The spec declares the legacy path eliminated. There is no external API consumer; the only UI caller is `components/accounting/period-close-dialog.tsx` invoked from `settings/periods/page.tsx`. The "soft deprecation" pattern (`@deprecated` JSDoc + runtime warning) is not worth the overhead for a same-sprint migration.

### Order of operations (tasks will be split, but the dependency is):

1. **Early**: add the new `period:close` permission to the RBAC matrix and grant it to all roles that currently have `accounting-config:write` or `reports:write` (so UI does not break silently).
2. **Early**: migrate UI components to call the new endpoint (`POST /api/organizations/[orgSlug]/monthly-close`) and pass the new payload shape (`{ periodId, justification? }`).
3. **Late (final task of the change)**: delete `FiscalPeriodsService.close`, delete the close branch of `PATCH /periods/[periodId]` (or delete the whole route if it had no other responsibility), delete `components/accounting/period-close-dialog.tsx` if no longer referenced.
4. **Route response for removed path**: if `PATCH /periods/[periodId]` is retained for other actions (e.g., name edit), it returns `410 Gone` with code `LEGACY_CLOSE_REMOVED` when the payload contains a close signal. If the entire route is removed, Next.js returns 404 naturally — that is acceptable because no external client depends on it.

### Transient stub

`FiscalPeriodsService.close` does NOT get a stub throwing `DeprecationError`. It is deleted in one commit. Rationale: a stub adds a code path that would need its own tests and its own removal task later. One delete, one test suite update, done.

---

## Test strategy

Strict TDD is enabled. Every scenario in the spec maps to a failing RED test before any service code is written.

### Unit tests (`monthly-close.service.test.ts`)

Repository is mocked. Each test exercises one branch:

| Test | Spec REQ |
|------|----------|
| close succeeds on balanced OPEN period with no drafts | REQ-1, REQ-5, REQ-9 |
| close rejects with `PERIOD_ALREADY_CLOSED` on CLOSED period | REQ-7 |
| close rejects with `PERIOD_HAS_DRAFTS`, payload has per-entity counts | REQ-4 |
| close rejects with `PERIOD_UNBALANCED`, payload has debit/credit/diff | REQ-3 |
| close rejects with `PERIOD_NOT_FOUND` if period does not exist or crosses orgs | — |
| CloseResult contains generated correlationId | REQ-8 |

### Integration tests (`monthly-close.repository.test.ts`)

Real Postgres via test DB (`DATABASE_URL` pointed at test schema). These are the tests that catch trigger behavior.

| Test | Asserts |
|------|---------|
| `sumDebitCredit` over known-balanced fixtures returns equal Decimals | aggregation correctness |
| After a successful `close()`, every `Dispatch/Payment/JournalEntry/Sale/Purchase` POSTED row is LOCKED | REQ-5 |
| After close, `audit_logs` has at least one `entityType='fiscal_periods'` row with `action='STATUS_CHANGE'` | REQ-A4, REQ-9 |
| All `audit_logs` rows emitted during a single close share the same non-null `correlationId` | REQ-8 |
| Two back-to-back closes on different periods produce distinct correlationIds | REQ-8 |
| A mutation outside any close (standalone dispatch update) emits `correlationId = NULL` | REQ-A1 |
| `purchases` UPDATE outside a close emits exactly one audit row | REQ-A5 |

### End-to-end transactionality (`monthly-close.integration.test.ts`)

One test: force a failure mid-cascade (e.g., mock `lockJournalEntries` to throw) and assert that `fiscal_periods.status` is still OPEN and no documents are LOCKED — full rollback.

### RED-first discipline

The `__tests__/monthly-close.rbac.test.ts` file already exists and tests page-level access. It will be updated to assert the new `period:close` permission. All new test files land as RED commits before any implementation commit.

### Property tests — deferred

A `fast-check` property test over "any balanced JE set always closes; any unbalanced set always rejects" is valuable but out of scope for this change. Flagged as a future improvement.

---

## Risks and mitigations (design-level)

### R1 — `setAuditContext` forgotten, trigger reads NULL

**Shape**: future refactor moves `close()` logic into a helper that calls the repo lock methods without first calling `setAuditContext`. Trigger runs, emits audit rows with NULL user/correlation. Data rot, not a runtime failure.

**Mitigation**:
- Integration test asserts every row has non-null `correlationId` AND non-null `changedById`.
- The service-level contract: `setAuditContext` is the FIRST statement inside `$transaction`. Code review rule.
- Future work (out of scope): wrap repo `lockXxx` methods to refuse to run unless session vars are set (read them back via `SELECT current_setting(...)` before UPDATE). Adds a round-trip per lock. Only justified if the bug recurs.

### R2 — `SET LOCAL` with connection pooling

**Shape**: `@prisma/adapter-pg` uses its own pool. If Prisma internally grabs a new connection mid-`$transaction` (it should not, but library bugs exist), `SET LOCAL` visibility is lost.

**Mitigation**:
- Integration test listed above is the direct probe; if the pool misbehaves, `correlationId` goes NULL and the assertion fires.
- Documented invariant: one logical transaction = one connection. This is the documented Prisma contract; a violation is a Prisma bug, not our concern to work around.

### R3 — Cascade lock ordering

**Shape**: if `JournalEntry` is locked first, and that trigger's `to_jsonb(NEW)` / cascade somehow interferes with subsequent `Dispatch`/`Payment` UPDATEs (unlikely — they are independent tables), lock order matters.

**Mitigation**:
- Document the lock order explicitly: `Dispatch → Payment → JournalEntry → Sale → Purchase → FiscalPeriod`. Starts with operational documents, ends with journal entries and then the period row itself (last mutation is the period state change — the "commit" of the close).
- Postgres AFTER ROW triggers run per-row as each UPDATE completes; they do not interact across tables. The risk is theoretical but the rule is a cheap invariant.

### R4 — `closedAt` timezone

**Shape**: `DateTime` stored UTC via Prisma default. UI displays in `America/La_Paz` (UTC-4). An accountant closes at 11 PM local = 03:00 UTC next day; a naive display could render the "wrong date."

**Mitigation**:
- Database and service return UTC `Date` instances.
- UI layer formats with `Intl.DateTimeFormat('es-BO', { timeZone: 'America/La_Paz' })` at the render boundary.
- Not a design-time code change; flagged for task-level implementation in the UI task.

### R5 — Destructive migration applied in wrong environment

**Shape**: migration runs against a populated dev DB that an engineer forgot to treat as disposable; `DROP TABLE fiscal_periods CASCADE` deletes journal entries.

**Mitigation**:
- Migration header loudly declares destructiveness (see SQL block above).
- Recommend `pg_dump` ritual in the migration header and in the proposal's operational notes.
- Reseed command documented.
- No further code mitigation possible — this is a process constraint.

---

## Operational notes

### Team rule (re-stated for visibility)

> Direct `UPDATE`/`DELETE`/`INSERT` against any audit-triggered table (`dispatches`, `payments`, `journal_entries`, `sales`, `purchases`, `fiscal_periods`) is forbidden. All mutations go through the corresponding service layer. Scripts, migrations, and maintenance tasks are NOT exempt — they import and call the service, or they get rejected at review.

Full context in `proposal.md` § Operational constraints.

### Migration rollback

There is **no rollback path**. `DROP TABLE fiscal_periods CASCADE` is irreversible via migration mechanics. The documented recovery is:

```bash
pnpm prisma migrate reset --force   # nukes the DB
pnpm prisma migrate deploy           # re-applies all migrations
pnpm prisma:seed                     # re-seeds test data
```

This is acceptable only because dev data is disposable. A production environment reaching this migration triggers a STOP — replan required.

### Justification semantics

`justification` on the close payload is OPTIONAL. It is NOT the same as the LOCKED-edit justification (REQ-A6, which is mandatory and has length minimums). Close-time justification is free-form context ("cerrando enero, conciliación del banco terminada"); if provided, it lands in every audit row via `app.audit_justification`. If omitted, rows carry NULL in `justification`.

---

## Dependencies on other specs

- `monthly-period-close/spec.md` — the WHAT this design implements.
- `audit-log/spec.md` — the AuditLog delta spec; this design realizes REQ-A1 through REQ-A5 via the migration and trigger function above. REQ-A6 (LOCKED-edit justification enforcement) is **NOT** in the close path — it lives in `features/shared/document-lifecycle.service.ts` and is a separate task within this change.
- Proposal § Out of scope — `FiscalYear` hierarchy, period reopening, DB-level CHECK on justification: all unchanged.
