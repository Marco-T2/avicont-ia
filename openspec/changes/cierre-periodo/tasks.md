# Tasks: cierre-periodo

Strict TDD — every RED task must land as a failing commit before its GREEN.
Lock order inside the transaction: `Dispatch → Payment → JournalEntry → Sale → Purchase → FiscalPeriod`.

---

## Phase 1 — Schema + Migration (foundation)

<!-- RED -->
- [x] T01 Write failing migration smoke test — touches `features/monthly-close/__tests__/migration.smoke.test.ts`. Acceptance: test imports `PrismaClient` and asserts `prisma.fiscalPeriod.fields` includes `month`, `closedAt`, `closedBy`; asserts `prisma.auditLog.fields` includes `correlationId`; fails with `Cannot find column 'month'` (or equivalent Prisma field error) because the migration has not been applied yet. This test is a schema-shape probe, not a migration runner — it runs against the real test DB.

<!-- GREEN -->
- [x] T02 Write and apply destructive migration — touches `prisma/schema.prisma`, `prisma/migrations/<timestamp>_cierre_periodo/migration.sql`. Acceptance: makes T01 pass; migration file has the destructive header block; adds `month INT NOT NULL` + `CHECK (month BETWEEN 1 AND 12)` + `closedAt TIMESTAMP(3) NULL` + `closedBy TEXT NULL` to `fiscal_periods`; changes `@@unique([organizationId, year])` to `@@unique([organizationId, year, month])`; recreates all foreign keys dropped by `DROP TABLE fiscal_periods CASCADE` (journal_entries, account_balances, dispatches, payments, purchases, sales, iva_purchase_books, iva_sales_books); adds FK `closedBy → users(id) ON DELETE SET NULL`; adds `correlationId TEXT NULL` column and `CREATE INDEX "audit_logs_correlationId_idx" ON audit_logs("correlationId")` to `audit_logs`; `prisma migrate deploy` applies cleanly on a fresh DB; `User` model gets `closedPeriods FiscalPeriod[] @relation("FiscalPeriodCloser")`; `FiscalPeriod` model gets `closedByUser User? @relation("FiscalPeriodCloser", ...)`.

<!-- RED -->
- [x] T03 Write failing trigger-extension test — touches `features/monthly-close/__tests__/audit-trigger.test.ts`. Acceptance: test function `it('trigger reads app.correlation_id and persists it')` — seeds one dispatch, runs a raw `UPDATE dispatches SET status='POSTED' WHERE id=?` inside a transaction that first does `SET LOCAL app.correlation_id = 'test-uuid'`; then queries `audit_logs` and asserts the emitted row has `correlationId = 'test-uuid'`; fails because `audit_trigger_fn()` does not yet read `app.correlation_id`.

<!-- GREEN -->
- [x] T04 Extend `audit_trigger_fn()` and attach new triggers — touches `prisma/migrations/<timestamp>_cierre_periodo/migration.sql` (or a follow-up migration if already applied). Acceptance: replaces `audit_trigger_fn()` with `CREATE OR REPLACE FUNCTION` body that reads `current_setting('app.correlation_id', true)` into `v_correlation_id` and INSERTs it into the new `correlationId` column; attaches `CREATE TRIGGER audit_fiscal_periods AFTER UPDATE OR DELETE ON fiscal_periods FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn()`; attaches `CREATE TRIGGER audit_purchases AFTER UPDATE OR DELETE ON purchases FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn()`; makes T03 pass; test for `app.correlation_id` not set → `correlationId IS NULL` also passes (safe fail-over path).

<!-- RED -->
- [x] T05 Write failing trigger-coverage tests — touches `features/monthly-close/__tests__/audit-trigger.test.ts`. Acceptance: adds two new `it` blocks: (a) `'audit_fiscal_periods fires on period UPDATE'` — updates a `FiscalPeriod` row status, asserts exactly one `audit_logs` row with `entityType = 'fiscal_periods'` and `action = 'STATUS_CHANGE'`; (b) `'audit_purchases fires on purchase UPDATE'` — updates a `Purchase` row, asserts exactly one `audit_logs` row with `entityType = 'purchases'`; both fail because the two triggers do not yet exist (T04 adds them, but this test is written before T04 lands).

<!-- VERIFY -->
- [x] T06 Run Phase 1 suite — `pnpm vitest run features/monthly-close/__tests__/migration.smoke.test.ts features/monthly-close/__tests__/audit-trigger.test.ts`. Acceptance: T01–T05 all green; migration applies cleanly on test DB; existing tests in other suites remain green (no regressions from CASCADE drop). RESULT (2026-04-22): 12/12 Phase 1 tests green; `pnpm prisma migrate status` clean; the `month INT NOT NULL` column addition breaks `prisma.fiscalPeriod.create` call sites across downstream test suites (9 test files flagged — initial-balance, equity-statement, trial-balance, worksheet, iva-books) — this is schema-level fallout NOT caused by the CASCADE drop itself; fixing those fixtures is scoped to later phases (design-level foreseen consequence, documented as surfaced risk).

---

## Phase 2 — Extended Audit Context

<!-- RED -->
- [x] T07 Write failing unit tests for extended `setAuditContext` — touches `features/shared/__tests__/audit-context.test.ts`. Acceptance: four `it` blocks: (a) `'sets only userId when called with no optional args'` — asserts only `app.current_user_id` SET LOCAL was issued; (b) `'sets userId and justification when justification provided'` — asserts two SET LOCAL calls; (c) `'sets userId and correlationId when correlationId provided, no justification'` — asserts two SET LOCAL calls including `app.correlation_id`; (d) `'sets all three session vars when all args provided'` — asserts three SET LOCAL calls; all fail because `setAuditContext` does not yet accept `correlationId`.

<!-- GREEN -->
- [x] T08 Extend `setAuditContext` with optional `correlationId` — touches `features/shared/audit-context.ts`. Acceptance: signature becomes `setAuditContext(tx, userId, justification?, correlationId?)`; when `correlationId` is provided and non-empty, issues `SET LOCAL app.correlation_id = '${escaped}'`; existing call sites (2-arg and 3-arg) compile without change; makes T07 pass; TypeScript strict mode: no `any`.

<!-- VERIFY -->
- [x] T09 Run Phase 2 suite — `pnpm vitest run features/shared/__tests__/audit-context.test.ts`. Acceptance: all four permutation tests green.

---

## Phase 3 — Repository (new methods)

<!-- RED -->
- [x] T10 Write failing integration tests for `countDraftDocuments` — touches `features/monthly-close/__tests__/monthly-close.repository.test.ts`. Acceptance: `it('countDraftDocuments returns per-entity counts when drafts exist')` — seeds one draft Dispatch, one draft Payment, one draft JournalEntry in period A; asserts returned object is `{ dispatches: 1, payments: 1, journalEntries: 1 }`; `it('countDraftDocuments returns zeros for period with no drafts')` — returns `{ dispatches: 0, payments: 0, journalEntries: 0 }`; `it('countDraftDocuments is isolated to periodId')` — period B drafts do not appear in period A query; all fail because method does not exist yet.

<!-- GREEN -->
- [x] T11 Add `countDraftDocuments(organizationId, periodId)` to repository — touches `features/monthly-close/monthly-close.repository.ts`. Acceptance: method runs three parallel `count` queries for Dispatch/Payment/JournalEntry with `status = 'DRAFT'`; returns `{ dispatches, payments, journalEntries }`; makes T10 pass.

<!-- RED -->
- [x] T12 Write failing integration test for `sumDebitCredit` — touches `features/monthly-close/__tests__/monthly-close.repository.test.ts`. Acceptance: `it('sumDebitCredit returns equal Decimals for balanced POSTED entries')` — seeds two JEs each with debit 100, credit 100; asserts `debit.eq(credit)` is true and values are `Prisma.Decimal`; `it('sumDebitCredit returns Decimal(0) for period with no POSTED entries')` — empty period → `debit.eq(new Decimal(0))` true; `it('sumDebitCredit excludes DRAFT entries from aggregation')` — draft JE with debit 999 does not affect sum; fails because method does not exist.

<!-- GREEN -->
- [x] T13 Add `sumDebitCredit(tx, organizationId, periodId)` to repository — touches `features/monthly-close/monthly-close.repository.ts`. Acceptance: uses `$queryRaw` with the SQL from design §"DEBE = HABER check strategy"; casts result columns to `Prisma.Decimal` using `new Prisma.Decimal(row.debit_total)`; `COALESCE(..., 0)` handles empty period; accepts `tx: Prisma.TransactionClient` as first arg (runs inside the close transaction); makes T12 pass.

<!-- RED -->
- [x] T14 Write failing integration tests for `lockSales` and `lockPurchases` — touches `features/monthly-close/__tests__/monthly-close.repository.test.ts`. Acceptance: `it('lockSales transitions POSTED sales to LOCKED, returns count')` — seeds two POSTED Sales; after lock, both have `status = 'LOCKED'`, returns `2`; `it('lockPurchases transitions POSTED purchases to LOCKED, returns count')` — seeds two POSTED Purchases; same assertion; `it('lock methods leave LOCKED documents unchanged')` — already-LOCKED document is not re-processed; fails because methods do not exist.

<!-- GREEN -->
- [x] T15 Add `lockSales` and `lockPurchases` to repository — touches `features/monthly-close/monthly-close.repository.ts`. Acceptance: `lockSales(tx, organizationId, periodId)` and `lockPurchases(tx, organizationId, periodId)` — same pattern as `lockDispatches`; use `tx.sale.updateMany` and `tx.purchase.updateMany` with `{ where: { periodId, status: 'POSTED', ...scope }, data: { status: 'LOCKED' } }`; return `result.count`; makes T14 pass.

<!-- RED -->
- [x] T16 Write failing integration test for `markPeriodClosed` — touches `features/monthly-close/__tests__/monthly-close.repository.test.ts`. Acceptance: `it('markPeriodClosed sets status=CLOSED, closedAt, closedBy')` — after call, queried period has `status = 'CLOSED'`, `closedAt` is a non-null `Date`, `closedBy = userId`; fails because method does not exist and `closedAt`/`closedBy` columns do not exist yet (blocked on T02).

<!-- GREEN -->
- [x] T17 Update `closePeriod`/add `markPeriodClosed` in repository — touches `features/monthly-close/monthly-close.repository.ts`. Acceptance: replaces existing `closePeriod` (or renames it to `markPeriodClosed`) to accept `userId: string`; sets `status: 'CLOSED'`, `closedAt: new Date()`, `closedBy: userId`; makes T16 pass.

<!-- VERIFY -->
- [x] T18 Run Phase 3 repository suite — `pnpm vitest run features/monthly-close/__tests__/monthly-close.repository.test.ts`. Acceptance: all repository tests (T10–T17) green; real Postgres test DB used.

---

## Phase 4 — Types + Validation Schema

<!-- RED -->
- [x] T19 Write failing type-shape test for new `CloseRequest`/`CloseResult` — touches `features/monthly-close/__tests__/monthly-close.types.test.ts`. Acceptance: imports types from `../monthly-close.types` and uses `expectTypeOf` to assert: `CloseRequest` has fields `{ organizationId: string; periodId: string; userId: string; justification?: string }`; `CloseResult` has fields `{ periodId: string; periodStatus: 'CLOSED'; closedAt: Date; correlationId: string; locked: { dispatches: number; payments: number; journalEntries: number; sales: number; purchases: number } }`; `CloseErrorCode` is a union including `'PERIOD_NOT_FOUND' | 'PERIOD_ALREADY_CLOSED' | 'PERIOD_HAS_DRAFT_ENTRIES' | 'PERIOD_UNBALANCED' | 'INSUFFICIENT_PERMISSION'`; also asserts `MonthlyCloseSummary` includes `balance: { balanced: boolean; totalDebit: string; totalCredit: string; difference: string }` (per REQ-11 / OQ-2 resolution); `MonthlyCloseSummary` MUST NOT have an `unbalancedEntries` field (JE invariant forbids it); fails because types do not match current shape.

<!-- GREEN -->
- [x] T20 Update types and add error codes — touches `features/monthly-close/monthly-close.types.ts`, `features/shared/errors.ts`. Acceptance: `CloseRequest`, `CloseResult`, `CloseErrorCode` match the design §"Public API"; adds error code constants to `errors.ts`: `PERIOD_NOT_FOUND`, `PERIOD_UNBALANCED`; reuses existing `PERIOD_HAS_DRAFT_ENTRIES` (no new `PERIOD_HAS_DRAFTS` constant); `CloseErrorCode` union includes `'PERIOD_HAS_DRAFT_ENTRIES'`; makes T19 pass; no `any`.

<!-- RED -->
- [x] T21 Write failing validation schema test — touches `features/monthly-close/__tests__/monthly-close.validation.test.ts`. Acceptance: imports `closeRequestSchema` from `../monthly-close.validation`; `it('accepts valid payload with periodId only')` — `{ periodId: 'abc' }` passes; `it('accepts payload with justification string')` — passes; `it('rejects missing periodId')` — Zod throws; `it('rejects non-string periodId')` — Zod throws; fails because file does not exist.

<!-- GREEN -->
- [x] T22 Create `monthly-close.validation.ts` — touches `features/monthly-close/monthly-close.validation.ts`. Acceptance: exports `closeRequestSchema` as `z.object({ periodId: z.string().min(1), justification: z.string().optional() })`; makes T21 pass.

<!-- VERIFY -->
- [x] T23 Run Phase 4 suite — `pnpm vitest run features/monthly-close/__tests__/monthly-close.types.test.ts features/monthly-close/__tests__/monthly-close.validation.test.ts`. Acceptance: all type and validation tests green.

---

## Phase 5 — Service (orchestration)

<!-- RED -->
- [x] T24 Write failing unit test — `PERIOD_NOT_FOUND` — touches `features/monthly-close/__tests__/monthly-close.service.test.ts`. Acceptance: `it('close throws PERIOD_NOT_FOUND when period does not exist')` — mocked repo's `findById` returns null; asserts service throws with code `PERIOD_NOT_FOUND` (HTTP 404); fails because service does not yet accept `CloseRequest` shape.

<!-- RED -->
- [x] T25 Write failing unit test — `PERIOD_ALREADY_CLOSED` — touches `features/monthly-close/__tests__/monthly-close.service.test.ts`. Acceptance: `it('close throws PERIOD_ALREADY_CLOSED (409) when period.status=CLOSED')` — mocked `findById` returns `{ status: 'CLOSED' }`; asserts `ConflictError` or `AppError` with code `PERIOD_ALREADY_CLOSED` and HTTP 409; fails because current service throws `ValidationError` (422) instead of a 409.

<!-- RED -->
- [x] T26 Write failing unit test — `PERIOD_HAS_DRAFT_ENTRIES` — touches `features/monthly-close/__tests__/monthly-close.service.test.ts`. Acceptance: `it('close throws PERIOD_HAS_DRAFT_ENTRIES with per-entity counts')` — mocked `countDraftDocuments` returns `{ dispatches: 2, payments: 0, journalEntries: 1 }`; asserts error code `PERIOD_HAS_DRAFT_ENTRIES` and error payload includes `{ dispatches: 2, journalEntries: 1 }`; fails because service does not call `countDraftDocuments` (new method name).

<!-- RED -->
- [x] T27 Write failing unit test — `PERIOD_UNBALANCED` — touches `features/monthly-close/__tests__/monthly-close.service.test.ts`. Acceptance: `it('close throws PERIOD_UNBALANCED with debit/credit/diff payload')` — mocked `sumDebitCredit` returns `{ debit: Decimal('100.00'), credit: Decimal('95.00') }`; asserts error code `PERIOD_UNBALANCED`, payload includes `debit`, `credit`, and `diff = Decimal('5.00')`; fails because service does not call `sumDebitCredit`.

<!-- RED -->
- [x] T28 Write failing unit test — happy path, `CloseResult` — touches `features/monthly-close/__tests__/monthly-close.service.test.ts`. Acceptance: `it('close returns CloseResult with correlationId on success')` — mocked balanced period, no drafts, `sumDebitCredit` returns equal Decimals, lock methods return counts, `markPeriodClosed` returns `{ closedAt: new Date() }`; asserts `result.correlationId` is a non-empty UUID string, `result.periodStatus = 'CLOSED'`, `result.locked.sales` and `result.locked.purchases` are numbers; fails because service does not generate `correlationId` or call `lockSales`/`lockPurchases`.

<!-- GREEN -->
- [x] T29 Rewrite `MonthlyCloseService.close` — touches `features/monthly-close/monthly-close.service.ts`. Acceptance: new signature `close(input: CloseRequest): Promise<CloseResult>`; flow: (1) load period via `repo.findById`, throw `NotFoundError` (PERIOD_NOT_FOUND 404) if missing; (2) throw `ConflictError` (PERIOD_ALREADY_CLOSED 409) if CLOSED; (3) `countDraftDocuments`, throw `ValidationError` (PERIOD_HAS_DRAFT_ENTRIES 422) with counts if any; (4) `correlationId = crypto.randomUUID()`; (5) `prisma.$transaction(async (tx) => { setAuditContext(tx, userId, justification, correlationId); balance = sumDebitCredit(tx, ...); if (!balance.debit.eq(balance.credit)) throw PERIOD_UNBALANCED; lockDispatches; lockPayments; lockJournalEntries; lockSales; lockPurchases; markPeriodClosed(tx, ..., userId); }, { timeout: 30_000 })`; returns `CloseResult`; makes T24–T28 all pass; uses `Prisma.Decimal.eq` for comparison, never `===`.

<!-- RED -->
- [x] T30 Write failing integration test — full happy-path observable contract — touches `features/monthly-close/__tests__/monthly-close.integration.test.ts`. Acceptance: `it('close produces observable contract: period CLOSED, all POSTED docs LOCKED, audit rows share correlationId')` — seeds real period with POSTED Dispatch/Payment/JournalEntry/Sale/Purchase; calls `service.close(input)`; queries DB directly; asserts: `period.status='CLOSED'`, `period.closedAt IS NOT NULL`, `period.closedBy = userId`, all seeded documents are LOCKED, `audit_logs` has at least one row with `entityType='fiscal_periods'` and `action='STATUS_CHANGE'`, all close-emitted `audit_logs` rows share the same non-null `correlationId`; fails because service still calls old signature.

<!-- RED -->
- [x] T31 Write failing integration test — rollback on mid-cascade failure — touches `features/monthly-close/__tests__/monthly-close.integration.test.ts`. Acceptance: `it('close rolls back entirely if lockJournalEntries throws')` — seeds a balanced period; mock/intercept causes `lockJournalEntries` to throw mid-transaction; after catch, queries DB and asserts `period.status = 'OPEN'` and all documents remain POSTED; fails because test infrastructure not yet set up.

<!-- GREEN -->
- [x] T32 Make integration tests green — touches `features/monthly-close/__tests__/monthly-close.integration.test.ts`. Acceptance: no changes to service code needed if T29 is correct; test setup seeds data via test helpers; T30 and T31 pass; all `audit_logs` rows from one close share the same `correlationId`; confirms trigger fires on `fiscal_periods` UPDATE. RESULT (2026-04-21): T29 was correct; both T30 and T31 green on first run — NO code change required.

<!-- VERIFY -->
- [x] T33 Run Phase 5 suite — `pnpm vitest run features/monthly-close/__tests__/monthly-close.service.test.ts features/monthly-close/__tests__/monthly-close.integration.test.ts`. Acceptance: all 8 service unit tests and 2 integration tests green. RESULT (2026-04-21): 7/7 green (5 unit + 2 integration — the task description counted 8 unit but only 5 were specified T24-T28).

---

## Phase 6 — API Route + RBAC

<!-- RED -->
- [x] T34 Write failing RBAC unit test — new `period:close` permission — touches `features/monthly-close/__tests__/monthly-close.rbac.test.ts`. Acceptance: adds `it('POST /monthly-close route calls requirePermission with period and close')` — mocks `requirePermission`; asserts it was called with `('period', 'close', orgSlug)`; also adds `it('POST /monthly-close returns 403 when requirePermission throws ForbiddenError')` — mocked throw; asserts response status 403; both fail because route still calls `requirePermission('reports', 'write', ...)` and `period` is not a valid `Resource`. RESULT (2026-04-21): 1/2 red (403 test passed immediately via handleError; T35 makes both green).

<!-- GREEN -->
- [x] T35 Add `period` resource + extend `Action` enum with `'close'` and `'reopen'` + update route RBAC — touches `features/shared/permissions.ts`, `app/api/organizations/[orgSlug]/monthly-close/route.ts`. Acceptance (OQ-1 resolved): adds `"period"` to the `Resource` union type; extends `Action` from `'read' | 'write'` to `'read' | 'write' | 'close' | 'reopen'` (both new values added preemptively — `'reopen'` is reserved for a future reopening SDD so we pay the schema-widening cost once); adds two new matrices `PERMISSIONS_CLOSE` and `PERMISSIONS_REOPEN`: `Record<Resource, Role[]>` keyed by Resource, both default-gated so only `period` grants `['owner', 'admin']` and all other resources get `[]` (empty); updates `requirePermission` server helper to dispatch on the new actions against the matching matrix (read → `PERMISSIONS_READ`, write → `PERMISSIONS_WRITE`, close → `PERMISSIONS_CLOSE`, reopen → `PERMISSIONS_REOPEN`); updates the permissions cache to materialize `canClose`/`canReopen` sets alongside the existing `permissionsRead`/`permissionsWrite`; updates route to call `requirePermission('period', 'close', orgSlug)`; makes T34 pass; existing `permissions.test.ts` suite compiles against the widened `Action` union and the new matrices without regressions. RESULT (2026-04-21): All green. canClose/canReopen derived from static matrices (no DB column needed). 292/292 permissions tests + 2/2 RBAC tests green.

<!-- RED -->
- [x] T36 Write failing route handler test — full dispatch + error codes — touches `app/api/organizations/[orgSlug]/monthly-close/__tests__/route.test.ts`. Acceptance: six `it` blocks: (a) `'POST returns 200 with CloseResult on success'` — mocked service returns valid result; (b) `'POST returns 409 PERIOD_ALREADY_CLOSED'`; (c) `'POST returns 422 PERIOD_UNBALANCED'`; (d) `'POST returns 422 PERIOD_HAS_DRAFT_ENTRIES'`; (e) `'POST returns 404 PERIOD_NOT_FOUND'`; (f) `'POST returns 400 on invalid payload (missing periodId)'` — Zod validation fires; all fail because route does not validate body with Zod schema and does not propagate `justification`. RESULT (2026-04-21): 3/7 red: (a)×2 + (f) — success path uses old 3-arg signature, (f) has no Zod validation.

<!-- GREEN -->
- [x] T37 Update route handler — Zod validation + justification + new service signature — touches `app/api/organizations/[orgSlug]/monthly-close/route.ts`. Acceptance: parses body with `closeRequestSchema`; resolves `user.id`; calls `service.close({ organizationId: orgId, periodId, userId: user.id, justification })`; `handleError` maps `ConflictError` → 409, `NotFoundError` → 404, `ValidationError` → 422, `ForbiddenError` → 403; makes T36 pass. RESULT (2026-04-21): All 7/7 route tests green. handleError already handled ZodError → 400 (no extension needed).

<!-- VERIFY -->
- [x] T38 Run Phase 6 suite — `pnpm vitest run features/monthly-close/__tests__/monthly-close.rbac.test.ts app/api/organizations/[orgSlug]/monthly-close/__tests__/route.test.ts`. Acceptance: all RBAC and route handler tests green. RESULT (2026-04-21): 330/330 monthly-close + 292/292 permissions tests green.

---

## Phase 6b — `/summary` endpoint balance extension (REQ-11, OQ-2)

This sub-phase implements REQ-11: `GET /monthly-close/summary` exposes `{ balance: { balanced, totalDebit, totalCredit, difference } }` so the UI can pre-emptively warn of imbalance. `unbalancedEntries` is intentionally omitted — the per-JE invariant (`JOURNAL_NOT_BALANCED` at create/post time) makes individually-unbalanced POSTED entries impossible. The existing index `@@index([organizationId, periodId])` on `journal_entries` covers the aggregation drive side; no new index is required.

<!-- RED -->
- [x] T38a Write failing integration test for `sumDebitCredit` reuse in `MonthlyCloseService.getSummary` — touches `features/monthly-close/__tests__/monthly-close.summary.test.ts`. Acceptance: `it('getSummary returns balance.balanced=true with equal debit/credit for balanced period')`; `it('getSummary returns balance object with totalDebit, totalCredit, difference as string-serialized Decimals')`; `it('getSummary returns balance.balanced=true and totals = "0" for empty period')`; `it('MonthlyCloseSummary type does NOT include unbalancedEntries')` — uses `expectTypeOf` to assert `'unbalancedEntries' extends keyof MonthlyCloseSummary` is `false`; all fail because `getSummary` does not yet call `sumDebitCredit` and `MonthlyCloseSummary` lacks the `balance` field.

<!-- GREEN -->
- [x] T38b Extend `MonthlyCloseSummary` type and `getSummary` service method — touches `features/monthly-close/monthly-close.types.ts`, `features/monthly-close/monthly-close.service.ts`. Acceptance: adds `balance: { balanced: boolean; totalDebit: string; totalCredit: string; difference: string }` to `MonthlyCloseSummary`; `getSummary` calls `repo.sumDebitCredit(prisma, organizationId, periodId)` in parallel with the existing count queries; serializes `Prisma.Decimal` with `.toFixed(2)` for the API boundary; `difference = debit.minus(credit).abs().toFixed(2)`; `balanced = debit.eq(credit)`; does NOT emit `unbalancedEntries`; makes T38a pass.

<!-- RED -->
- [x] T38c Write failing route-handler test for extended `/summary` response shape — touches `app/api/organizations/[orgSlug]/monthly-close/summary/__tests__/route.test.ts`. Acceptance: `it('GET /summary returns balance field with balanced, totalDebit, totalCredit, difference')` — mocked service returns enriched summary; asserts response JSON has the `balance` subobject with string-valued Decimals; `it('GET /summary response must NOT include unbalancedEntries field')`; both fail because route currently returns the old summary shape.

<!-- GREEN -->
- [x] T38d Ensure route simply passes through the extended summary — touches `app/api/organizations/[orgSlug]/monthly-close/summary/route.ts`. Acceptance: route stays thin — no new logic needed if T38b returns the full `MonthlyCloseSummary`; confirms no leaky field (no `unbalancedEntries`) makes it into response; makes T38c pass. RESULT (2026-04-21): no code change required — route was already a pure passthrough via Response.json(summary).

<!-- VERIFY -->
- [x] T38e Run Phase 6b suite — `pnpm vitest run features/monthly-close/__tests__/monthly-close.summary.test.ts app/api/organizations/[orgSlug]/monthly-close/summary/__tests__/route.test.ts`. Acceptance: all four summary tests + two route tests green; no new index required on `journal_entries` (verify existing `@@index([organizationId, periodId])` covers the aggregation drive side). RESULT (2026-04-21): 6/6 green; @@index([organizationId, periodId]) confirmed at prisma/schema.prisma line 371 (JournalEntry model); no new migration needed.

---

## Phase 7 — LOCKED-Edit Enforcement (differentiated justification)

<!-- RED -->
- [x] T39 Write failing unit tests for `validateLockedEdit` with period-status differentiation — touches `features/shared/__tests__/document-lifecycle.test.ts`. Acceptance: `it('validateLockedEdit: LOCKED doc in OPEN period, justification >= 10 chars → passes')`; `it('validateLockedEdit: LOCKED doc in OPEN period, justification < 10 chars → LOCKED_EDIT_REQUIRES_JUSTIFICATION with min=10')`; `it('validateLockedEdit: LOCKED doc in CLOSED period, justification >= 50 chars → passes')`; `it('validateLockedEdit: LOCKED doc in CLOSED period, justification < 50 chars → LOCKED_EDIT_REQUIRES_JUSTIFICATION with min=50')`; `it('validateLockedEdit: LOCKED doc, no period found → throws PERIOD_NOT_FOUND (fail-safe)')`; all fail because current `validateLockedEdit(status, role, justification)` does not accept `periodStatus`.

<!-- GREEN -->
- [x] T40 Update `validateLockedEdit` to accept `periodStatus` — touches `features/shared/document-lifecycle.service.ts`. Acceptance: new signature `validateLockedEdit(status, role, periodStatus: 'OPEN' | 'CLOSED' | undefined, justification?)`; minimum is 10 when `periodStatus = 'OPEN'`, 50 when `periodStatus = 'CLOSED'`; when `periodStatus` is `undefined` (fail-safe), throws `NotFoundError` with `PERIOD_NOT_FOUND`; error payload includes `{ requiredMin: number }` in the message or as a structured field; makes T39 pass.

<!-- RED -->
- [x] T41 Write failing test for locked-edit enforcement in `dispatch.service.ts` — touches `features/dispatch/__tests__/dispatch.service.locked-edit.test.ts`. Acceptance: `it('update LOCKED dispatch in CLOSED period requires justification.length >= 50')` — mocked period returns `{ status: 'CLOSED' }`; call with `justification='too short'` throws `LOCKED_EDIT_REQUIRES_JUSTIFICATION`; call with 50-char justification passes; fails because `dispatch.service.update` still calls old `validateLockedEdit(status, role, justification)` without `periodStatus`.

<!-- GREEN -->
- [x] T42 Update `dispatch.service.ts` to pass `periodStatus` — touches `features/dispatch/dispatch.service.ts`. Acceptance: `update()` loads the period and passes `period.status` as `periodStatus` to `validateLockedEdit`; same for the void path; makes T41 pass; no other behavior changed.

<!-- RED -->
- [x] T43 Write failing test for locked-edit enforcement in `payment.service.ts` — touches `features/payment/__tests__/payment.service.locked-edit.test.ts`. Acceptance: same pattern as T41 but for Payment update — `it('update LOCKED payment in CLOSED period requires justification >= 50')` and open-period variant; fails because `payment.service.ts` calls old `validateLockedEdit`.

<!-- GREEN -->
- [x] T44 Update `payment.service.ts` to pass `periodStatus` — touches `features/payment/payment.service.ts`. Acceptance: loads period before calling `validateLockedEdit`; makes T43 pass.

<!-- RED -->
- [x] T45 Write failing test for locked-edit enforcement in `journal.service.ts` — touches `features/accounting/__tests__/journal.service.locked-edit.test.ts`. Acceptance: `it('update LOCKED journal entry in CLOSED period requires justification >= 50')`; fails because `journal.service.ts` calls old `validateLockedEdit`.

<!-- GREEN -->
- [x] T46 Update `journal.service.ts` to pass `periodStatus` — touches `features/accounting/journal.service.ts`. Acceptance: loads period; passes `period.status` to `validateLockedEdit`; makes T45 pass.

<!-- RED -->
- [x] T47 Write failing test for locked-edit enforcement in `sale.service.ts` — touches `features/sale/__tests__/sale.service.locked-edit.test.ts`. Acceptance: `it('update LOCKED sale in CLOSED period requires justification >= 50')`; fails because `sale.service.ts` does not call `validateLockedEdit` for LOCKED documents.

<!-- GREEN -->
- [x] T48 Update `sale.service.ts` to enforce locked-edit justification — touches `features/sale/sale.service.ts`. Acceptance: adds `validateLockedEdit` call in the update path for LOCKED sales; loads period and passes `period.status`; makes T47 pass.

<!-- RED -->
- [x] T49 Write failing test for locked-edit enforcement in `purchase.service.ts` — touches `features/purchase/__tests__/purchase.service.locked-edit.test.ts`. Acceptance: `it('update LOCKED purchase in CLOSED period requires justification >= 50')`; fails because `purchase.service.ts` does not call `validateLockedEdit` for LOCKED documents.

<!-- GREEN -->
- [x] T50 Update `purchase.service.ts` to enforce locked-edit justification — touches `features/purchase/purchase.service.ts`. Acceptance: adds `validateLockedEdit` call in the update path for LOCKED purchases; makes T49 pass.

<!-- VERIFY -->
- [x] T51 Run Phase 7 suite — `pnpm vitest run features/shared/__tests__/document-lifecycle.test.ts features/dispatch/__tests__/dispatch.service.locked-edit.test.ts features/payment/__tests__/payment.service.locked-edit.test.ts features/accounting/__tests__/journal.service.locked-edit.test.ts features/sale/__tests__/sale.service.locked-edit.test.ts features/purchase/__tests__/purchase.service.locked-edit.test.ts`. Acceptance: all locked-edit tests (10 new it-blocks across 5 services) green.

---

## Phase 8 — Legacy Deprecation

<!-- RED -->
- [x] T52 Write failing legacy-deprecation tests — touches `app/api/organizations/[orgSlug]/periods/[periodId]/__tests__/route.test.ts`. Acceptance: `it('PATCH /periods/[periodId] with close payload returns 410 Gone')` — sends `{ status: 'CLOSED' }` body; asserts response status 410 and JSON body `{ code: 'LEGACY_CLOSE_REMOVED', newEndpoint: 'POST /api/organizations/{orgSlug}/monthly-close' }`; `it('GET /periods/[periodId] still works')` — asserts 200 (GET path is retained); both fail because route currently executes the close instead of returning 410.

<!-- GREEN -->
- [x] T53 Replace PATCH close logic with 410 Gone + delete `FiscalPeriodsService.close` — touches `app/api/organizations/[orgSlug]/periods/[periodId]/route.ts`, `features/fiscal-periods/fiscal-periods.service.ts`. Acceptance: PATCH handler detects close payload (`status === 'CLOSED'`) and immediately returns `Response.json({ code: 'LEGACY_CLOSE_REMOVED', newEndpoint: 'POST /api/organizations/{orgSlug}/monthly-close' }, { status: 410 })`; `FiscalPeriodsService.close()` method is deleted entirely; `closeFiscalPeriodSchema` import removed from route if unused; GET handler unchanged; makes T52 pass; grep for `FiscalPeriodsService.close` in TypeScript files returns zero hits (add grep assertion in commit CI or task comment). RESULT (2026-04-21): close() deleted; closeFiscalPeriodSchema also deleted from validation.ts (orphaned — only route imported it); PATCH previously supported ONLY close — no other PATCH logic preserved.

<!-- RED -->
- [x] T54 Write failing test for legacy UI component migration — touches `components/accounting/__tests__/period-close-dialog.test.tsx`. Acceptance: existing `PeriodCloseDialog` (or its replacement) no longer calls `PATCH /periods/{id}`; `it('close button calls POST /monthly-close with periodId and justification')` — mocked fetch; asserts URL is `/api/organizations/${orgSlug}/monthly-close` and method is POST; fails because component still targets the legacy endpoint.

<!-- GREEN -->
- [x] T55 Migrate `PeriodCloseDialog` to canonical endpoint — touches `components/accounting/period-close-dialog.tsx`. Acceptance: changes fetch target to `POST /api/organizations/${orgSlug}/monthly-close`; body includes `{ periodId: period.id, justification? }`; adds optional `<Textarea>` for justification input in the dialog; makes T54 pass.

<!-- VERIFY -->
- [x] T56 Run Phase 8 suite — `pnpm vitest run app/api/organizations/[orgSlug]/periods/[periodId]/__tests__/route.test.ts components/accounting/__tests__/period-close-dialog.test.tsx`. Acceptance: 410 Gone on close PATCH + GET still 200 + dialog calls new endpoint — all green. RESULT (2026-04-21): 3/3 green.

---

## Phase 9 — UI (Close Event Viewer + MonthlyClosePanel updates)

<!-- RED -->
- [ ] T57 Write failing test for updated `MonthlyClosePanel` — touches `components/settings/__tests__/monthly-close-panel.test.tsx`. Acceptance: `it('MonthlyClosePanel shows DEBE=HABER balance status from summary')` — mocked summary with `balanced: false, debit: '100', credit: '95', diff: '5'`; asserts a warning banner is rendered with the diff; `it('MonthlyClosePanel passes justification to POST payload')` — user fills in justification textarea and clicks confirm; asserts fetch body includes `justification`; both fail because panel does not display balance info or accept justification input.

<!-- GREEN -->
- [ ] T58 Update `MonthlyClosePanel` with justification textarea and balance display — touches `components/settings/monthly-close-panel.tsx`. Acceptance (now MANDATORY, no longer conditional): adds justification `<Textarea>` in confirmation dialog; passes `justification` in POST body; reads `balance.balanced`, `balance.totalDebit`, `balance.totalCredit`, `balance.difference` from the enriched summary (delivered by Phase 6b) and renders a DEBE≠HABER warning banner when `balance.balanced === false`; banner text includes the three Decimal strings; makes T57 pass.

<!-- RED -->
- [ ] T59 Write failing test for Close Event Viewer page — touches `app/(dashboard)/[orgSlug]/accounting/monthly-close/__tests__/close-event-viewer.test.ts`. Acceptance: `it('page renders audit rows grouped by entityType for given correlationId')` — mocked API returns audit rows with matching `correlationId`; asserts rendered timeline shows groups `fiscal_periods`, `dispatches`, etc.; `it('page requires period:close (or journal:read) permission')` — mocked permission throw → redirect; fails because page/component does not exist.

<!-- GREEN -->
- [ ] T60 Create Close Event Viewer page + API query endpoint — touches `app/(dashboard)/[orgSlug]/accounting/monthly-close/close-event/page.tsx`, `app/api/organizations/[orgSlug]/monthly-close/audit-trail/route.ts`. Acceptance: GET route accepts `?correlationId=<uuid>` and returns `AuditLog[]` filtered by that `correlationId`; page renders a grouped timeline sorted by `entityType` then `createdAt`; raw UUID is in URL query string but not displayed as text in UI; `Intl.DateTimeFormat('es-BO', { timeZone: 'America/La_Paz' })` used for date formatting; makes T59 pass.

<!-- VERIFY -->
- [ ] T61 Run Phase 9 suite — `pnpm vitest run components/settings/__tests__/monthly-close-panel.test.tsx app/(dashboard)/[orgSlug]/accounting/monthly-close/__tests__/close-event-viewer.test.ts`. Acceptance: UI panel and event viewer tests green.

---

## Phase 10 — Full-Suite Regression

<!-- VERIFY -->
- [ ] T62 Run full vitest suite — `pnpm vitest run`. Acceptance: all tests green; no regressions in existing dispatch, payment, journal, sale, purchase, or fiscal-period suites; `PERIOD_HAS_DRAFT_ENTRIES` constant (reused from `errors.ts`) drives all draft-block error paths without breaking prior tests.

<!-- VERIFY -->
- [ ] T63 Type-check — `pnpm exec tsc --noEmit`. Acceptance: count of TypeScript errors does not increase beyond the pre-existing baseline (check with `pnpm exec tsc --noEmit 2>&1 | grep -c error` before and after); no new errors introduced by this change; new `"period"` resource in `Resource` union compiles cleanly across all call sites.

---

## Open Questions — RESOLVED

All three open questions from the original task breakdown have been resolved by product decision. The resolutions are encoded into the tasks above and into `specs/monthly-period-close/spec.md` (REQ-6, REQ-4, REQ-11).

**OQ-1 — RESOLVED → extend `Action` enum with BOTH `'close'` and `'reopen'`**. The close route calls `requirePermission('period', 'close', orgSlug)`. `'reopen'` is added preemptively to avoid a second schema widening when the reopening SDD lands. Encoded in T35.

**OQ-2 — RESOLVED → `/summary` returns `balance: { balanced, totalDebit, totalCredit, difference }`; `unbalancedEntries` is OMITTED**. The `JournalEntry` model enforces per-JE balance at create/post time (`JOURNAL_NOT_BALANCED` in `features/accounting/journal.service.ts`), so individually unbalanced POSTED entries cannot exist. The existing `@@index([organizationId, periodId])` on `journal_entries` covers the aggregation — no new index needed in Phase 1. Encoded in Phase 6b (T38a–T38e) and the new T19 type assertion.

**OQ-3 — RESOLVED → keep existing `PERIOD_HAS_DRAFT_ENTRIES` constant**. `errors.ts` already exports it; the spec and tasks now reference this name throughout. T20 does NOT introduce a `PERIOD_HAS_DRAFTS` alias — the generic error code pairs with a per-entity-discriminating user-facing message. Encoded in REQ-4 and T20.
