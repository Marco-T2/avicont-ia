# Monthly Period Close Specification

## Purpose

`MonthlyCloseService.close` is the single canonical operation that seals a monthly accounting period. It is used by accountants and administrators to formally end a month: it validates that the period's books balance (DEBE = HABER), locks all POSTED documents atomically, marks the period CLOSED, and emits a correlated audit trail. Once closed a period cannot be reopened without a separate, explicitly-scoped change. The legacy `FiscalPeriodsService.close` path is eliminated by this spec; all close traffic routes through this capability.

---

## Requirements

### REQ-1: Period State Machine — OPEN → CLOSED (one-way)

A `FiscalPeriod` carries a status of `OPEN` or `CLOSED`. The close operation is a one-way transition: `OPEN → CLOSED`. Reopening a CLOSED period is out of scope for this change and requires a separate spec.

#### Scenarios

- **When** a period with `status = OPEN` is closed successfully, **then** `period.status` becomes `CLOSED`, `period.closedAt` is set to the current timestamp, and `period.closedBy` is set to the acting user's ID.
- **When** the close operation fails at any validation step, **then** the period `status` remains `OPEN` and no documents are locked.
- **When** a period with `status = CLOSED` receives a close request, **then** the system MUST reject with error code `PERIOD_ALREADY_CLOSED` — a silent no-op is explicitly forbidden.

---

### REQ-2: Monthly Uniqueness — One Period per (organizationId, year, month)

The `FiscalPeriod` model enforces a DB-level unique constraint on `(organizationId, year, month)`. `month` is an integer in the range 1–12 (calendar month). Multiple periods within the same year are allowed, one per calendar month. There is no annual-period concept in this change.

#### Scenarios

- **When** an attempt is made to create a second period for the same `(organizationId, year, month)`, **then** the database rejects the insert with a unique-constraint violation, surfaced to the caller as a domain error.
- **When** two different organizations each create a period for `(year=2026, month=1)`, **then** both succeed — the unique constraint is scoped per organization.
- **When** a single organization creates periods for `month=1` and `month=2` of the same year, **then** both succeed — the constraint does not block distinct months within the same year.

---

### REQ-3: DEBE = HABER Invariant — Mandatory Precondition for Close

Before transitioning a period to CLOSED, the system MUST verify that the sum of debits equals the sum of credits across all `POSTED` `JournalEntry` records belonging to that period. Equality is evaluated using `Prisma.Decimal` arithmetic (no floating-point coercion). If debits ≠ credits the close is rejected; the check is not skippable by any role or flag.

#### Scenarios

- **When** a period's POSTED journal entries have `SUM(debit) = SUM(credit)` (both evaluated as `Prisma.Decimal`), **then** the balance check passes and close proceeds.
- **When** a period's POSTED journal entries have `SUM(debit) ≠ SUM(credit)`, **then** the close is rejected with error code `PERIOD_UNBALANCED`, and the response MUST include the computed debit total, credit total, and the absolute difference in Bolivianos.
- **When** a period has zero POSTED journal entries, **then** the balance check trivially passes (`0 = 0`) and close proceeds — an empty period is closeable.

---

### REQ-4: Draft Documents Block Close

The presence of any document in `DRAFT` status — across `Dispatch`, `Payment`, or `JournalEntry` within the period — MUST block the close. All three entity types are checked. If any drafts exist, the system rejects with error code `PERIOD_HAS_DRAFT_ENTRIES`, and the response MUST include the counts per entity type to guide the user.

> **Decision**: Drafts block close. Rationale: a draft document represents unfinished intent. Allowing close over drafts would silently leave un-reviewed financial data in a sealed period, making the audit trail misleading. The counts-per-type in the error message give the user a concrete remediation path.

> **Note on naming (OQ-3 resolved)**: the error constant in `features/shared/errors.ts` is `PERIOD_HAS_DRAFT_ENTRIES` (already exported). This spec aligns with that name — there is no separate `PERIOD_HAS_DRAFTS` constant.

> **Note on user-facing message**: the error CODE is generic (`PERIOD_HAS_DRAFT_ENTRIES`), but the user-facing MESSAGE MUST discriminate by entity type — e.g., "Existen borradores pendientes: 3 despachos, 1 asiento de diario." The wording is flexible; the requirement is that the human message name each entity type with a non-zero count so the user can act. The machine payload (see scenarios) separately exposes per-entity counts as structured fields.

#### Scenarios

- **When** a period has one or more `Dispatch`, `Payment`, or `JournalEntry` in `DRAFT` status, **then** close is rejected with `PERIOD_HAS_DRAFT_ENTRIES` and a payload listing draft counts per entity type (`{ dispatches, payments, journalEntries }`), and the user-facing message names each non-zero entity type in words.
- **When** all documents in the period are `POSTED` or `LOCKED` (no DRAFTs), **then** the draft check passes and close proceeds to the balance check.
- **When** only `JournalEntry` drafts exist (but dispatches and payments are all POSTED), **then** close is still rejected — all three entity types must be draft-free.

---

### REQ-5: Mass Lock Cascade — POSTED → LOCKED in One Transaction

Closing a period transitions all `POSTED` documents to `LOCKED` in a single database transaction. The entities locked are: `Dispatch`, `Payment`, `JournalEntry`, `Sale`, and `Purchase`. The transition is atomic — either all documents are locked and the period is closed, or nothing changes.

> **Decision on Sale and Purchase**: `Sale` and `Purchase` are locked independently as first-class documents, not only via their linked `JournalEntry`. Rationale: (a) symmetry — `Dispatch` and `Payment` are already locked directly; not locking `Sale`/`Purchase` directly would create an asymmetric contract where two financial document types are only "soft-locked" via their JE; (b) auditability — a `STATUS_CHANGE` audit row on the `Sale` or `Purchase` itself is a cleaner anchor for document-level audits than inferring lock from the JE; (c) the newly-added trigger on `purchases` (see audit-log spec) and the existing trigger on `sales` mean locking these directly generates audit rows at the correct entity level.

#### Scenarios

- **When** a period close succeeds, **then** all `Dispatch`, `Payment`, `JournalEntry`, `Sale`, and `Purchase` records in `POSTED` status within that period are updated to `LOCKED` within the same database transaction that marks the period `CLOSED`.
- **When** the transaction that performs the lock cascade fails (e.g., DB error mid-transaction), **then** the entire operation is rolled back — no partial locks and no period status change are persisted.
- **When** a period has documents already in `LOCKED` status (from a previous partial operation), **then** the close operation MUST NOT fail on those — only `POSTED → LOCKED` transitions are performed; already-LOCKED documents are left unchanged.
- **When** a period has no `POSTED` documents (empty period), **then** the lock cascade is a no-op and close proceeds normally.

---

### REQ-6: RBAC — `period:close` Permission Required

The close operation requires the `period:close` permission. This is a **new, dedicated permission**, not the existing `reports:write`.

> **Decision (OQ-1 resolved)**: the `Action` enum is extended with BOTH `'close'` AND `'reopen'` preemptively. A new `period` resource is added to the `Resource` union. The close route calls `requirePermission('period', 'close', orgSlug)`. The `'reopen'` value is not consumed by this change, but a future reopening SDD will need it and adding both actions in a single schema change is cheaper than two sequential migrations to the enum. The `PERMISSIONS_*` matrices gate `period:close` and `period:reopen` to `['owner', 'admin']` by default.

> **Justification for a dedicated `period:close`**: `reports:write` signals write access to report-like outputs (PDFs, exports, summaries). Closing a period is a fundamentally different class of action — it is an **irreversible write to domain state** that locks financial documents and transitions the period's lifecycle. Bundling it under `reports:write` would violate the principle of least privilege: a user authorized to regenerate reports would also gain the power to seal accounting periods. Separation of concerns demands a dedicated permission.

The legacy `FiscalPeriodsService.close` path uses `accounting-config:write` — that path is eliminated by this change. All close traffic routes through the canonical endpoint guarded by `period:close`.

#### Scenarios

- **When** a user with `period:close` permission sends a close request for a valid OPEN period in their organization, **then** the request proceeds to business rule validation.
- **When** a user without `period:close` permission sends a close request, **then** the system rejects with error code `INSUFFICIENT_PERMISSION` and HTTP 403 before any business logic runs.
- **When** a user with `reports:write` but NOT `period:close` sends a close request, **then** the system rejects with `INSUFFICIENT_PERMISSION` — `reports:write` does not grant close access.
- **When** the `Action` enum is introspected, **then** it contains `'read' | 'write' | 'close' | 'reopen'` — the `'reopen'` value is reserved for a future reopening capability and is not consumed by this change.

---

### REQ-7: Idempotency — Second Close is Rejected

Closing an already-CLOSED period is explicitly rejected with `PERIOD_ALREADY_CLOSED`. There is no silent no-op behavior: the system MUST return an error so that any retry logic or UI knows the state clearly.

> **Decision**: Reject with error code over silent no-op. Rationale: a no-op would mask bugs in UI retry logic and make it impossible to distinguish "I sent the request twice" from "the first request actually worked." An explicit error forces callers to check period state before retrying and makes integration tests unambiguous.

#### Scenarios

- **When** a close request is sent for a period with `status = CLOSED`, **then** the system rejects immediately with error code `PERIOD_ALREADY_CLOSED` and HTTP 409 without executing any lock cascade or audit emission.
- **When** a close request is sent for a period with `status = OPEN` and succeeds, and then the same request is retried, **then** the retry receives `PERIOD_ALREADY_CLOSED` — the operation is not re-executed.

---

### REQ-8: Correlation ID — All Audit Rows Share One ID Per Close

When `MonthlyCloseService.close` runs, it generates a UUID (`correlationId`) at the start of the operation and propagates it to all audit rows emitted during that transaction. After a successful close, querying `AuditLog` by `correlationId` MUST return all and only the rows emitted by that close operation.

#### Scenarios

- **When** a period close succeeds, **then** all `AuditLog` rows emitted during the close transaction carry the same non-null `correlationId`.
- **When** two separate close operations run (on different periods), **then** each produces a distinct `correlationId` — rows from one close MUST NOT share the ID of the other.
- **When** an audit row is emitted outside of a close operation (e.g., a standalone document update), **then** its `correlationId` is `null`.

---

### REQ-9: Post-Close State Observable Contract

After a successful close, the following conditions MUST all hold and MUST be verifiable by querying the database directly (not inferred from service return values):

- `FiscalPeriod.status = CLOSED`
- `FiscalPeriod.closedAt` is a non-null timestamp
- `FiscalPeriod.closedBy` is the ID of the user who triggered the close
- All `Dispatch`, `Payment`, `JournalEntry`, `Sale`, `Purchase` that were `POSTED` before close are now `LOCKED`
- At least one `AuditLog` row exists with `entityType = 'fiscal_periods'` and the period's `entityId`, with `action = 'STATUS_CHANGE'` and a non-null `correlationId`

#### Scenarios

- **When** a close succeeds, **then** all five conditions above hold when queried directly from the database.
- **When** any one of these conditions does not hold after a purported successful close, **then** the close is considered to have failed silently and the test covering this scenario MUST fail.

---

### REQ-10: Domain Event `FiscalPeriodClosed` — Deferred

No event bus infrastructure (`BullMQ`, `Kafka`, `NATS`, `EventEmitter`-based domain-events) exists in this codebase at the time of this spec. Emitting a `FiscalPeriodClosed` domain event is deferred to a future change when an event bus is introduced. This is noted as a known gap, not an oversight.

> **Decision**: No event emission in this change. Evidence: grep over all `.ts` files for `eventBus`, `domain-events`, `@/events`, `bullmq`, `kafka`, and `nats` returns zero results. Adding an in-process `EventEmitter` as a one-off for this change would introduce a fragile, non-standard pattern. The correct approach is to introduce an event bus as a dedicated infrastructure SDD change and then wire `FiscalPeriodClosed` at that point.

---

### REQ-11: `/summary` Endpoint Exposes Balance State

The `GET /api/organizations/{orgSlug}/monthly-close/summary?periodId=<id>` endpoint MUST return the period's balance state so the UI can pre-emptively warn about imbalances before the user attempts to close. The response body MUST include the following fields in addition to the existing posted/draft counts and voucher-type breakdown:

```ts
{
  balance: {
    balanced: boolean,          // true iff totalDebit.eq(totalCredit)
    totalDebit: string,         // Prisma.Decimal serialized as string
    totalCredit: string,
    difference: string          // |totalDebit - totalCredit|
  }
}
```

> **Decision (OQ-2 resolved — `unbalancedEntries` OMITTED)**: the response MUST NOT include a per-entry `unbalancedEntries[]` field. The `JournalEntry` model enforces the DEBE=HABER invariant at create/post time (`features/accounting/journal.service.ts` throws `JOURNAL_NOT_BALANCED` on any attempt to create or post a JE whose lines do not balance). Therefore individually-unbalanced POSTED entries CANNOT exist in the database; emitting an empty array on every call would be dead weight that wastes bytes and invites future code to search for a case the schema forbids. If a future change ever relaxes the per-JE invariant, this spec must be updated first.

> **Decision on backing index**: the summary query sums `JournalLine.debit` and `JournalLine.credit` joined through `JournalEntry` for a given `periodId`. The existing `@@index([organizationId, periodId])` on `journal_entries` covers the drive side of the join — no new index is required by this change. If migration inspection reveals the index is missing or incomplete, the migration MUST add it in Phase 1 (not deferred).

#### Scenarios

- **When** a summary is requested for a period whose POSTED entries sum to equal debit and credit, **then** the response has `balance.balanced = true` and `balance.difference = "0"`.
- **When** a summary is requested for a period whose POSTED entries sum to unequal debit and credit (an edge case that implies external data corruption, since the per-JE invariant forbids it normally), **then** the response has `balance.balanced = false`, and `totalDebit`, `totalCredit`, `difference` are all non-zero Decimal strings.
- **When** a summary is requested for an empty period, **then** `balance.totalDebit = balance.totalCredit = "0"` and `balance.balanced = true`.
- **When** any caller inspects the response shape, **then** no `unbalancedEntries` field is present — it is intentionally omitted.

---

## Error Code Registry

| Code | HTTP | Meaning |
|---|---|---|
| `PERIOD_ALREADY_CLOSED` | 409 | Period is already in CLOSED state |
| `PERIOD_UNBALANCED` | 422 | SUM(debit) ≠ SUM(credit) for POSTED journal entries |
| `PERIOD_HAS_DRAFT_ENTRIES` | 422 | One or more documents exist in DRAFT state (per-entity counts in payload) |
| `PERIOD_NOT_FOUND` | 404 | No period found for given ID in this organization |
| `INSUFFICIENT_PERMISSION` | 403 | Caller does not have `period:close` permission |
