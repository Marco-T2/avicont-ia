# Spec: members-clerk-sync-saga

**Change**: members-clerk-sync-saga
**Date**: 2026-04-23
**Type**: New spec (no prior members-service spec exists)

---

## Ground Truths (Invariants)

| # | Invariant |
|---|-----------|
| I-1 | `OrganizationMember.deactivatedAt` is the soft-delete field. `null` = active; non-null timestamp = deactivated. This is the DB authority for membership state. |
| I-2 | `user.clerkUserId` is the bridge key between our `User` row and the Clerk identity. All Clerk org-membership calls use this field. |
| I-3 | Clerk org membership is the auth gate. A user removed from Clerk cannot authenticate into the org, regardless of DB state. |
| I-4 | DB is the primary system of record. Clerk is a subordinate auth mirror. DB writes always precede Clerk calls. |
| I-5 | `handleError` serializes `AppError` subclasses via `error.statusCode`. `ExternalSyncError` MUST set `statusCode: 503`. No route-level mapping is needed. |
| I-6 | The new-member path (lines 127-132) CURRENTLY swallows non-duplicate Clerk errors and proceeds to the DB write. This is a known bug — not a "by design" decision — and MUST be eliminated. |
| I-7 | `isSystem` on `Role` is not consulted by `addMember`/`removeMember`. Guard logic checks `role === "owner"` and self-deactivation via `currentClerkUserId`. No invariant collision here. |
| I-8 | Tenant isolation: ALL repo mutations MUST be scoped by `organizationId` WHERE clause (per commits `906a9bd`, `e882d54`). `hardDelete(organizationId, memberId)` follows this pattern. |

---

## Requirements

### REQ-MCS.1 — `addMember` new-member saga (DB-first with compensation)

The system MUST write the `OrganizationMember` row to DB BEFORE calling Clerk. On Clerk failure the system MUST compensate (hard-delete the DB row) and surface 503 via `ExternalSyncError`. If compensation also fails, the system MUST log `members.clerk_sync.divergent` and surface 503 with `divergentState` payload.

#### S-MCS.1-1 — Happy path: DB and Clerk both succeed

- **Given**: valid `organizationId`, `email`, `role`; user exists in DB; no prior membership
- **When**: `addMember` is called
- **Then**: DB row inserted (`deactivatedAt: null`), Clerk membership created, 200 returned with member DTO
- **Expected failure mode (pre-fix)**: passes today (Clerk-first path still results in both writes when both succeed)

#### S-MCS.1-2 — DB insert fails; no Clerk call made

- **Given**: `repo.addMember` rejects with a DB error
- **When**: `addMember` is called
- **Then**: no Clerk call is made, DB has no new row, 500 returned via existing `AppError` handling
- **Expected failure mode (pre-fix)**: Clerk IS called before DB today — DB failure leaves Clerk with an orphaned membership

#### S-MCS.1-3 — Clerk fails; compensation succeeds

- **Given**: DB insert succeeds; `createOrganizationMembership` rejects with a non-duplicate error
- **When**: `addMember` is called
- **Then**: compensation `hardDelete(organizationId, memberId)` runs, DB row removed, `ExternalSyncError` thrown, 503 returned, `members.clerk_sync.compensated` log emitted
- **Expected failure mode (pre-fix)**: Clerk error is swallowed (line 127-132), DB write proceeds, member added locally without Clerk — silent divergence

#### S-MCS.1-4 — Clerk fails; compensation also fails (double failure)

- **Given**: DB insert succeeds; Clerk rejects; `hardDelete` also rejects
- **When**: `addMember` is called
- **Then**: `ExternalSyncError` thrown with `divergentState: { db: "member_inserted", clerk: "membership_absent" }`, 503 returned, `members.clerk_sync.divergent` log emitted with `memberId`, `clerkUserId`, `organizationId`, `operation: "add"`, `correlationId`
- **Expected failure mode (pre-fix)**: Clerk error swallowed; DB write succeeds; neither log event fires; no 503

#### S-MCS.1-5 — Clerk returns duplicate-membership; treated as idempotent success

- **Given**: DB insert succeeds; `createOrganizationMembership` throws a duplicate error (`isClerkDuplicateError` returns true)
- **When**: `addMember` is called
- **Then**: no compensation, no error thrown, 200 returned with member DTO
- **Expected failure mode (pre-fix)**: passes today — `isClerkDuplicateError` already handles this; behavior preserved

---

### REQ-MCS.2 — `addMember` reactivation saga (DB-first with compensation)

On the reactivation branch the system MUST call `repo.reactivateMember` BEFORE calling Clerk. On Clerk failure the system MUST compensate by re-deactivating the row (restoring the original `deactivatedAt` timestamp). Double-failure emits `divergent` log and surfaces 503.

#### S-MCS.2-1 — Happy path: DB reactivated and Clerk membership created

- **Given**: existing member with non-null `deactivatedAt`; `reactivateMember` succeeds; Clerk succeeds
- **When**: `addMember` is called
- **Then**: `deactivatedAt` set to `null`, Clerk membership created, 200 returned
- **Expected failure mode (pre-fix)**: Clerk-first today — Clerk success then DB reactivate: both OK, passes

#### S-MCS.2-2 — DB reactivation fails; no Clerk call made

- **Given**: `repo.reactivateMember` rejects
- **When**: `addMember` is called
- **Then**: no Clerk call, 500 returned
- **Expected failure mode (pre-fix)**: Clerk called before DB today — Clerk success + DB failure leaves Clerk with the membership but our DB still shows the member as deactivated

#### S-MCS.2-3 — Clerk fails on reactivation; compensation re-deactivates

- **Given**: `reactivateMember` succeeds; Clerk rejects non-duplicate error
- **When**: `addMember` is called
- **Then**: compensation `repo.deactivateMember(organizationId, existing.id)` runs restoring `deactivatedAt`, 503 returned via `ExternalSyncError`, `members.clerk_sync.compensated` log emitted
- **Expected failure mode (pre-fix)**: today the non-duplicate Clerk error is re-thrown (line 97-101) WITHOUT compensation — the DB reactivation is NOT rolled back, leaving `deactivatedAt: null` while Clerk has no membership

#### S-MCS.2-4 — Clerk fails on reactivation; compensation also fails

- **Given**: `reactivateMember` succeeds; Clerk rejects; `deactivateMember` compensation rejects
- **When**: `addMember` is called
- **Then**: `ExternalSyncError` with `divergentState: { db: "member_active", clerk: "membership_absent" }`, 503, `members.clerk_sync.divergent` log
- **Expected failure mode (pre-fix)**: no compensation fires; DB is active; Clerk has no membership; no divergent log

#### S-MCS.2-5 — Clerk already-exists on reactivation; idempotent success

- **Given**: `reactivateMember` succeeds; Clerk throws duplicate error
- **When**: `addMember` is called
- **Then**: no compensation, 200 returned
- **Expected failure mode (pre-fix)**: passes today — same `isClerkDuplicateError` guard handles this

---

### REQ-MCS.3 — `removeMember` saga (DB-first deactivate with compensation)

The system MUST call `repo.deactivateMember` BEFORE calling Clerk. On Clerk failure the system MUST compensate by calling `repo.reactivateMember(organizationId, memberId, previousRole)` to restore the active row. Double-failure emits `divergent` log and surfaces 503.

#### S-MCS.3-1 — Happy path: DB deactivated and Clerk membership removed

- **Given**: active member; `deactivateMember` succeeds; `deleteOrganizationMembership` succeeds
- **When**: `removeMember` is called
- **Then**: `deactivatedAt` set to non-null, Clerk membership removed, 200 returned
- **Expected failure mode (pre-fix)**: Clerk-first today — both succeed, passes, but ordering is wrong

#### S-MCS.3-2 — DB deactivate fails; no Clerk call made

- **Given**: `repo.deactivateMember` rejects
- **When**: `removeMember` is called
- **Then**: no Clerk call, 500 returned
- **Expected failure mode (pre-fix)**: Clerk called first today — Clerk removes membership; DB write fails; user is removed from Clerk but DB still shows `deactivatedAt: null` (security hole)

#### S-MCS.3-3 — Clerk remove fails; compensation reactivates DB row

- **Given**: `deactivateMember` succeeds; `deleteOrganizationMembership` rejects with non-404 error
- **When**: `removeMember` is called
- **Then**: compensation `repo.reactivateMember(organizationId, memberId, previousRole)` runs, `deactivatedAt` set back to `null`, 503 returned via `ExternalSyncError`, `members.clerk_sync.compensated` log emitted
- **Expected failure mode (pre-fix)**: Clerk error is swallowed (line 213-216), `deactivateMember` proceeds — DB deactivated but Clerk removal never happened; silent divergence; user cannot authenticate but DB says deactivated

#### S-MCS.3-4 — Clerk remove fails; compensation reactivation also fails

- **Given**: `deactivateMember` succeeds; Clerk rejects; `reactivateMember` compensation rejects
- **When**: `removeMember` is called
- **Then**: `ExternalSyncError` with `divergentState: { db: "member_deactivated", clerk: "membership_present" }`, 503, `members.clerk_sync.divergent` log with `operation: "remove"`
- **Expected failure mode (pre-fix)**: Clerk error swallowed; `deactivateMember` proceeds; no 503, no divergent log

#### S-MCS.3-5 — Clerk returns 404 on remove; treated as idempotent success

- **Given**: `deactivateMember` succeeds; `deleteOrganizationMembership` throws a not-found error (`isClerkNotFoundError` returns true)
- **When**: `removeMember` is called
- **Then**: no compensation, 200 returned (member already absent from Clerk)
- **Expected failure mode (pre-fix)**: today the catch swallows ALL Clerk errors including 404 — behavior preserved but the explicit intent is now documented

---

### REQ-MCS.4 — `ExternalSyncError` as first-class error type

The system MUST expose `ExternalSyncError extends AppError` from `features/shared/errors.ts` with `statusCode: 503`. It MUST carry a `divergentState` field in `details` and an optional `retryAfterSeconds` hint. Its error code MUST be registered as `EXTERNAL_SYNC_ERROR` in the same file.

#### S-MCS.4-1 — `ExternalSyncError` serializes as 503 via existing handler

- **Given**: a service throws `new ExternalSyncError("...", { db: "member_inserted", clerk: "membership_absent" })`
- **When**: `handleError` processes it
- **Then**: response status is 503; body contains `{ "code": "EXTERNAL_SYNC_ERROR", "error": "...", "details": { "divergentState": {...} } }`
- **Expected failure mode (pre-fix)**: class does not exist; any thrown error falls through to 500 "Error interno del servidor"

#### S-MCS.4-2 — `ExternalSyncError` carries retry-after hint when provided

- **Given**: `new ExternalSyncError("msg", { divergentState: {...}, retryAfterSeconds: 30 })`
- **When**: serialized
- **Then**: `details.retryAfterSeconds` equals `30` in the response body
- **Expected failure mode (pre-fix)**: class does not exist

#### S-MCS.4-3 — `EXTERNAL_SYNC_ERROR` code registered in errors.ts

- **Given**: `features/shared/errors.ts` is imported
- **When**: `EXTERNAL_SYNC_ERROR` constant is accessed
- **Then**: value equals `"EXTERNAL_SYNC_ERROR"` (string constant, same pattern as existing codes)
- **Expected failure mode (pre-fix)**: constant absent; consumers cannot import it

---

### REQ-MCS.5 — Structured observability on divergence

The system MUST emit a structured log event `members.clerk_sync.divergent` ONLY when both the primary operation AND the compensation both fail. It MUST NOT fire on successful compensation. The event MUST include: `memberId`, `clerkUserId`, `organizationId`, `operation` (`add|reactivate|remove`), `dbState`, `clerkState`, `correlationId`.

#### S-MCS.5-1 — `divergent` log fires only on double failure

- **Given**: primary DB step succeeds; Clerk step fails; compensation step also fails
- **When**: `addMember` or `removeMember` completes
- **Then**: exactly one `members.clerk_sync.divergent` log call with all required fields
- **Expected failure mode (pre-fix)**: no structured log fires at all — current code uses bare `console.error` with no structured payload

#### S-MCS.5-2 — `divergent` log does NOT fire on successful compensation

- **Given**: primary DB step succeeds; Clerk step fails; compensation step succeeds
- **When**: service method completes
- **Then**: `members.clerk_sync.divergent` MUST NOT be emitted; `members.clerk_sync.compensated` MAY be emitted
- **Expected failure mode (pre-fix)**: no structured log either way; compensation success is currently a swallowed-error path

#### S-MCS.5-3 — `divergent` log includes all required fields

- **Given**: double-failure scenario on `removeMember`
- **When**: `members.clerk_sync.divergent` is emitted
- **Then**: log payload includes `memberId` (string), `clerkUserId` (string), `organizationId` (string), `operation: "remove"`, `dbState: "member_deactivated"`, `clerkState: "membership_present"`, `correlationId` (string, non-empty)
- **Expected failure mode (pre-fix)**: only `console.error("Error removing member from Clerk org:", error)` — no structured fields

---

### REQ-MCS.6 — Silent-fail elimination on new-member path

The system MUST NOT swallow Clerk errors on the new-member path. Non-duplicate Clerk errors on `createOrganizationMembership` MUST abort the operation and trigger saga compensation. The current `catch` block (lines 127-132) that logs-and-continues MUST be removed.

#### S-MCS.6-1 — Non-duplicate Clerk error surfaces as 503, not ignored

- **Given**: new-member path; `createOrganizationMembership` throws a non-duplicate error
- **When**: `addMember` is called
- **Then**: 503 returned via `ExternalSyncError`; DB row MUST NOT persist (compensation ran)
- **Expected failure mode (pre-fix)**: Clerk error logged and swallowed; DB write proceeds; member added locally without Clerk; 201 returned to caller — silent inconsistency

#### S-MCS.6-2 — Caller retry after 503 reaches consistent state

- **Given**: first call returned 503 from S-MCS.6-1; DB row was hard-deleted by compensation
- **When**: caller retries with identical inputs and Clerk is now healthy
- **Then**: DB row inserted, Clerk membership created, 200 returned; exactly one `OrganizationMember` row exists
- **Expected failure mode (pre-fix)**: first call "succeeded" with member in DB but not in Clerk; retry hits `ConflictError` (409) because DB row already exists

---

## Delta Deltas

### New spec files written

| File | Status |
|------|--------|
| `openspec/changes/members-clerk-sync-saga/spec.md` (this file) | NEW — no prior members-service spec exists in `openspec/specs/` |

### Existing spec files modified

None. No existing spec in `openspec/specs/` covers `MembersService` behavior.

### Existing spec files to update at archive time

| File | What changes |
|------|--------------|
| `openspec/specs/error-serialization/spec.md` REQ-1 scenario table | Add `ExternalSyncError` to the listed `AppError` subclasses; add `EXTERNAL_SYNC_ERROR` to the error-code table in REQ-5. |

### Invariant Collision — NONE BLOCKING, one advisory

The current behavior of the new-member path (swallowing Clerk errors) is documented in `explore.md` as a BUG (finding F #2). It is NOT encoded as "by design" in any existing spec, `// by design` comment, or enum. **No collision requiring proposal-phase revisit.** Advisory: the existing `removeMember` `catch` block comment ("Si no se encuentra en Clerk, ignorar") informally spec'd the swallow behavior — this spec explicitly supersedes it.

---

## Out-of-Scope Scenarios

| Scenario | Justification |
|----------|---------------|
| Clerk webhook → DB reconciliation | No webhook endpoint; deferred per `arquitectura-escalable` exploration |
| Concurrent `addMember` race (two simultaneous invites for same email) | Unique constraint on `OrganizationMember(organizationId, userId)` is the guard; ordering within concurrent requests is undefined here |
| `updateRole` Clerk sync | `updateRole` makes zero Clerk calls (verified); out of scope |
| Clerk org-level operations (`createOrganization`, `syncOrganization`) | Different surface, different change |
| Automatic retry of Clerk calls inside the request | Rejected by proposal §4 — amplifies latency |
| Background reconciler for `divergent` events | No scheduler infra; operator reconciles manually |
| Daily divergence-detection job | No scheduler infra |
| `isSystem` role flag impact on add/remove flows | Proposal verified: not consulted by these methods |
