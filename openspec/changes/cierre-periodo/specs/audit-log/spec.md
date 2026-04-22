# Audit Log Specification (Delta)

## Purpose

The audit log infrastructure captures every significant mutation on financial entities into the `audit_logs` table via PostgreSQL triggers and session variables. This is a **delta spec** — the base infrastructure exists and is not re-specified here. This document describes only the additions and modifications introduced by the `cierre-periodo` change.

Requirements marked **UNCHANGED** are listed for traceability only; they MUST NOT be re-implemented or overwritten.

---

## Delta: Unchanged (Reference Only)

These requirements exist in the base infrastructure and are NOT modified by this change. They are listed here for traceability.

- `audit_trigger_fn()` base behavior: reads `app.current_user_id` and `app.audit_justification` via `current_setting(..., true)`, constructs the `AuditLog` row, detects `STATUS_CHANGE` vs `UPDATE` vs `DELETE`.
- Triggers on `dispatches`, `payments`, `journal_entries`: AFTER UPDATE OR DELETE, FOR EACH ROW, invoking `audit_trigger_fn()`.
- Trigger on `sales`: AFTER UPDATE OR DELETE, FOR EACH ROW, invoking `audit_trigger_fn()` (added in `add_sale_module` migration).
- `setAuditContext(tx, userId, justification?)`: sets `app.current_user_id` and `app.audit_justification` via `SET LOCAL`.

---

## Delta: Additions

### REQ-A1: New Column `correlationId` on `AuditLog`

A new nullable column `correlationId: String?` is added to the `AuditLog` model (mapped to `audit_logs."correlationId"`). A database index is created on this column to support efficient lookup of all rows belonging to a single business operation.

#### Scenarios

- **When** an audit row is emitted during a transaction that set `app.correlation_id`, **then** the row's `correlationId` column contains that UUID.
- **When** an audit row is emitted outside of a correlated transaction (i.e., `app.correlation_id` was not set), **then** `correlationId` is `null` — the trigger must not fail.
- **When** querying `SELECT * FROM audit_logs WHERE "correlationId" = $1`, **then** the index on `correlationId` is used (verifiable via EXPLAIN).

---

### REQ-A2: Session Variable `app.correlation_id` Read by Trigger

The `audit_trigger_fn()` function is extended to read the session variable `app.correlation_id` via `current_setting('app.correlation_id', true)` and persist its value into the new `correlationId` column. The second argument `true` makes the call safe when the variable is not set — it returns `null` instead of raising an exception.

#### Scenarios

- **When** `SET LOCAL app.correlation_id = '<uuid>'` is issued within a transaction before trigger-generating mutations, **then** every `AuditLog` row emitted during that transaction carries `correlationId = '<uuid>'`.
- **When** the `app.correlation_id` session variable is not set in the current transaction, **then** `current_setting('app.correlation_id', true)` returns `null` and the trigger inserts `correlationId = null` without error.
- **When** two transactions run concurrently with different `app.correlation_id` values, **then** each transaction's audit rows carry their own respective ID — no cross-contamination (enforced by `SET LOCAL` session-level scoping).

---

### REQ-A3: `setAuditContext` Extended with Optional `correlationId`

The `setAuditContext` helper signature is extended to accept an optional `correlationId` parameter: `setAuditContext(tx, userId, justification?, correlationId?)`. When `correlationId` is provided and non-empty, the helper issues `SET LOCAL app.correlation_id = '<value>'` within the transaction. When omitted or `undefined`, the variable is not set (existing call sites are unaffected — no breaking change).

#### Scenarios

- **When** `setAuditContext(tx, userId, justification, correlationId)` is called with a non-null `correlationId`, **then** `app.correlation_id` is set in the transaction session and subsequent trigger-generating mutations carry that ID.
- **When** `setAuditContext(tx, userId)` is called without `correlationId` (existing call sites), **then** no `SET LOCAL app.correlation_id` is issued and existing behavior is preserved.
- **When** `setAuditContext(tx, userId, undefined, correlationId)` is called with `justification` omitted but `correlationId` provided, **then** only `app.correlation_id` is set; `app.audit_justification` is not set (or is set to `null`).

---

### REQ-A4: New Trigger on `fiscal_periods`

A new PostgreSQL trigger `audit_fiscal_periods` is attached to the `fiscal_periods` table. It fires AFTER UPDATE OR DELETE, FOR EACH ROW, and reuses the existing `audit_trigger_fn()`. This gives every period status change its own `AuditLog` row — the close event is a first-class auditable fact, not inferred from child-document rows.

#### Scenarios

- **When** a `FiscalPeriod` row is updated (e.g., `status` changes from `OPEN` to `CLOSED`), **then** exactly one `AuditLog` row is emitted with `entityType = 'fiscal_periods'`, `entityId = period.id`, and `action = 'STATUS_CHANGE'`.
- **When** a `FiscalPeriod` row is deleted, **then** exactly one `AuditLog` row is emitted with `action = 'DELETE'`.
- **When** the trigger fires during a `MonthlyCloseService.close` transaction, **then** the emitted row's `correlationId` matches the UUID set by `setAuditContext` for that transaction.

---

### REQ-A5: New Trigger on `purchases` (Parity with `sales`)

A new PostgreSQL trigger `audit_purchases` is attached to the `purchases` table. It fires AFTER UPDATE OR DELETE, FOR EACH ROW, and reuses the existing `audit_trigger_fn()`. This closes an auditability gap: `sales` already has an equivalent trigger; `purchases` does not. Adding both in the same migration avoids a future trigger-only migration.

#### Scenarios

- **When** a `Purchase` row is updated, **then** exactly one `AuditLog` row is emitted with `entityType = 'purchases'` and the correct `entityId`.
- **When** a `Purchase` row is deleted, **then** exactly one `AuditLog` row is emitted with `action = 'DELETE'`.
- **When** a period close locks `Purchase` rows (POSTED → LOCKED), **then** each locked `Purchase` emits a `STATUS_CHANGE` audit row with `correlationId` matching the close operation's UUID.

---

### REQ-A6: Service-Layer Enforcement — Justification Required for LOCKED Document Edits

Editing a document whose `status = LOCKED` requires a non-empty `justification`. The minimum length is differentiated by the status of the period the document belongs to:

| Period Status | Min Justification Length | Error Code |
|---|---|---|
| `OPEN` | 10 characters | `LOCKED_EDIT_REQUIRES_JUSTIFICATION` |
| `CLOSED` | 50 characters | `LOCKED_EDIT_REQUIRES_JUSTIFICATION` |

This validation lives in the service layer (not the DB trigger), because only the service layer has access to the period status and can return a structured error with the minimum length. The error response MUST include the required minimum so the UI can display a helpful message.

The same error code is used for both cases — the distinction is communicated via the error message payload, not a distinct code.

> **Operational constraint (spec invariant)**: Direct SQL `UPDATE`s on audit-triggered tables (`dispatches`, `payments`, `journal_entries`, `sales`, `purchases`, `fiscal_periods`) bypass the service layer. The trigger records passively; it does NOT enforce justification presence. The team convention is: ALL mutations to these tables MUST go through the corresponding service layer. Scripts, migrations, and maintenance tasks are not exempt.

#### Scenarios

- **When** a request edits a document with `status = LOCKED` in a period with `status = OPEN`, and `justification.length >= 10`, **then** the edit proceeds.
- **When** a request edits a document with `status = LOCKED` in a period with `status = OPEN`, and `justification` is absent or has fewer than 10 characters, **then** the service rejects with `LOCKED_EDIT_REQUIRES_JUSTIFICATION`, including the required minimum (10) in the error payload.
- **When** a request edits a document with `status = LOCKED` in a period with `status = CLOSED`, and `justification.length >= 50`, **then** the edit proceeds.
- **When** a request edits a document with `status = LOCKED` in a period with `status = CLOSED`, and `justification` has fewer than 50 characters (even if ≥ 10), **then** the service rejects with `LOCKED_EDIT_REQUIRES_JUSTIFICATION`, including the required minimum (50) in the error payload.
- **When** a document has `status = POSTED` (not `LOCKED`) in any period, **then** the justification minimum check does NOT apply — this requirement is scoped to LOCKED documents only.
- **When** a document has `status = LOCKED` but no period can be found (data integrity violation), **then** the service MUST fail safely (e.g., treat as CLOSED-level strictness or throw `PERIOD_NOT_FOUND`) — it MUST NOT silently allow the edit.

---

## Error Code Registry (Additions)

| Code | HTTP | Meaning |
|---|---|---|
| `LOCKED_EDIT_REQUIRES_JUSTIFICATION` | 422 | Edit on a LOCKED document is missing or has insufficient justification |
