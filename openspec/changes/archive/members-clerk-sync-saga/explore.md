# Exploration: members-clerk-sync-saga

**Date**: 2026-04-23
**Audit findings**: F #2 (addMember) and F #3 (removeMember)
**Severity**: CRITICAL — cross-system state corruption

---

## Context

`MembersService` orchestrates two systems of record: **Clerk** (auth/identity) and **Postgres** (our local DB). Both `addMember` and `removeMember` currently call Clerk BEFORE writing to the local DB. A Prisma `$transaction` CANNOT fix this — it has no rollback lever over an external HTTP API. The design decision here sets precedent for every future external-API integration in this codebase.

---

## Current State

### `addMember` — `features/organizations/members.service.ts:40-147`

**New member path (line 116-147)**:
1. Resolve user in local DB via `usersService.findByEmail` (line 42)
2. If not local: call `clerkClient().users.getUserList` (line 50) → sync user (line 63)
3. Guard: `repo.findMemberByEmail(...)` to detect active/deactivated (line 71)
4. **[BUG]** `clerkClient().organizations.createOrganizationMembership(...)` — line 122
5. `repo.addMember(...)` — line 134 ← **AFTER Clerk**

Failure mode: Clerk succeeds → DB write fails → user exists in Clerk org but NOT in our `OrganizationMember` table. Next invite: Clerk returns duplicate-member error (`isClerkDuplicateError` ignores it), but our DB still has no membership row. The user can appear to authenticate but holds no permissions.

**Reactivation path (line 85-113)**:
1. `clerkClient().organizations.createOrganizationMembership(...)` — line 92
2. `repo.reactivateMember(existing.id, role)` — line 105 ← **AFTER Clerk**

Same failure mode for the reactivation branch.

**Notable asymmetry in error handling**: new-member path (line 127-132) catches Clerk errors and **swallows non-duplicate errors silently** — Clerk fail doesn't prevent the DB write. Reactivation path (line 97-101) re-throws non-duplicate Clerk errors — aborting the flow. This inconsistency is itself a bug.

### `removeMember` — `features/organizations/members.service.ts:184-219`

1. Guard: `repo.findMemberById(...)` — owner + self check (lines 189-200)
2. `repo.findById(organizationId)` — get clerkOrgId (line 204)
3. **[BUG]** `clerkClient().organizations.deleteOrganizationMembership(...)` — line 209
4. `repo.deactivateMember(organizationId, memberId)` — line 218 ← **AFTER Clerk**

Failure mode: Clerk removal succeeds → DB `deactivateMember` fails → user is **gone from Clerk** (cannot authenticate) but still has `deactivatedAt: null` in our DB. They own data, appear active in permission checks, but cannot log in. Security issue.

### `updateRole` — `features/organizations/members.service.ts:149-182`

**No Clerk API calls**. Role in our DB is the source of truth for permissions. updateRole is LOCAL-ONLY — not flagged by the audit, and correctly so.

### Call graph

```
POST /api/organizations/[orgSlug]/members
  → route.ts:46 → service.addMember(organizationId, email, role)

DELETE /api/organizations/[orgSlug]/members/[memberId]
  → route.ts:55 → service.removeMember(organizationId, memberId, userId)

PATCH /api/organizations/[orgSlug]/members/[memberId]
  → route.ts:29 → service.updateRole(...) [no Clerk — safe]
```

**Test paths**:
- `features/organizations/__tests__/members.service.test.ts` — covers role guards, self-deactivate, cross-org isolation, duplicate detection. Does NOT cover Clerk-DB ordering.
- `app/api/organizations/[orgSlug]/members/__tests__/route.test.ts` — covers validation (PR6.2); mocks `MembersService` entirely.

---

## Existing Scaffolding Inventory

### Webhooks
- **No Clerk webhook endpoint exists.** The API tree (`app/api/`) has no `clerk/` or `webhooks/` directory. `proxy.ts` mounts only `clerkMiddleware()` for auth — no webhook receiver.
- No `svix` package in `package.json`. `@clerk/nextjs: ^7.0.7` and `@clerk/localizations: ^4.2.4` are the only Clerk deps.
- The `organizations/route.ts` (POST) is the closest: it's a "sync" endpoint called by the frontend after Clerk creates an org. It is NOT a webhook — it requires authenticated session and is frontend-driven.

### Background Jobs / Queues
- **None.** No `bull`, `pg-boss`, `inngest`, `temporal`, `agenda`, `bee-queue`, `redis` in `package.json`.
- The arquitectura-escalable exploration (`openspec/changes/arquitectura-escalable/exploration.md:91`) explicitly deferred background workers: "vale la pena el día que un export PDF se acerque a 10s". No implementation was done.

### Retry Patterns
- `journal.repository.ts:createWithRetryTx` — optimistic retry for voucher number contention (unique-constraint on `organizationId_voucherTypeId_periodId_number`). This is a **DB-only** retry within a single Prisma transaction — not applicable to cross-system cases.
- `isPrismaUniqueViolation` in `features/shared/prisma-errors.ts` — utility for the above retry loop.

### Idempotency
- `isClerkDuplicateError` in `members.service.ts:13-17` — partial: handles Clerk "already member" error codes on add, but ONLY for the non-duplicate error path.
- Seed scripts use `skipDuplicates: true` (Prisma). Not relevant to runtime operations.

**Conclusion**: Approaches 1 (webhook reconciliation) and 3 (transactional outbox) both require greenfield infrastructure. Approach 2 (saga with compensating transactions) is also greenfield but confined to `members.service.ts`. Approach 4 (accept + monitor) requires only logging/alerting changes.

---

## Approach Comparison

| Criterion | A: DB-first + Webhook Reconciliation | B: Saga (Compensating Tx) | C: Transactional Outbox | D: Accept + Monitoring |
|-----------|--------------------------------------|---------------------------|------------------------|------------------------|
| **Consistency guarantee** | Eventual (Clerk lags behind DB until webhook fires) | Strong (immediate rollback on failure) | Eventual (worker publishes asynchronously) | None (gap is accepted) |
| **Failure mode — Clerk unreachable** | DB write succeeds; Clerk sync deferred to webhook or retry. User exists locally, can't auth until Clerk catches up. | DB write aborted; user sees 503/retry. No state written. | DB write + outbox event committed; Clerk gets event when worker runs. | DB write may or may not happen (current bug unresolved). |
| **Failure mode — DB fails after Clerk** | Not applicable (DB is written first). | Compensating Clerk delete/restore fires. If compensating also fails: orphaned Clerk state + needs operator cleanup. | Not applicable (event is written atomically with DB change). | Remains as-is — Clerk and DB diverge silently. |
| **Implementation scope** | `members.service.ts` (reorder) + new webhook endpoint `app/api/clerk/webhooks/route.ts` + Clerk dashboard config + `svix` package | `members.service.ts` only — add compensating calls in `catch` blocks | `members.service.ts` (reorder to outbox write) + `OutboxEvent` Prisma model + worker process | `members.service.ts` (add structured log/alert) + doc |
| **Files touched** | ~4-6 files + new infra | 1 file (`members.service.ts`) | ~5 files + new Prisma model + worker | 1 file + doc |
| **Operational complexity** | Low-medium: webhook endpoint needs signature verification (svix), Clerk dashboard setup, idempotency on webhook replay | Low: no new infra; compensating Clerk API calls are synchronous | High: worker process, retry queues, dead-letter handling, at-least-once delivery | None |
| **Recovery UX when both legs fail** | Clerk webhook retries for 7 days; admin can re-trigger sync manually | User sees 503; can retry the operation | Worker retries from dead-letter; admin inspects outbox table | Admin must detect manually; no recovery path |
| **Latency impact** | None for addMember (DB first, Clerk second is immediate). Webhook re-sync is asynchronous and invisible to user. | None (same request, synchronous compensate) | None for the request; Clerk sync is async (milliseconds to seconds depending on worker poll interval) | None |
| **Clerk SDK idempotency** | `createOrganizationMembership` is idempotent (duplicate error handled by `isClerkDuplicateError`). `deleteOrganizationMembership` is NOT idempotent — calling twice is safe (404 on second call) but must be handled. | Same — compensating calls need error handling for "already removed" / "not found". | Same — worker must handle Clerk 409/404 on replay. | N/A |
| **Precedent it sets** | Establishes webhook-driven reconciliation for all external integrations | Establishes explicit compensating-transaction pattern | Establishes async outbox for all external integrations | No positive precedent |

---

## Scope Boundary Assessment

Both `addMember` and `removeMember` MUST be in scope — their failure modes are symmetric in severity (corruption vs. security hole). They also share the same fix surface (`members.service.ts`) regardless of approach chosen.

`updateRole` is NOT in scope — it makes no Clerk API calls. The role field in our DB is the sole authority for permissions.

The reactivation branch inside `addMember` (lines 85-113) is ALSO in scope — it has the same Clerk-before-DB ordering bug as the main new-member path.

---

## Open Questions

1. **Who is the authoritative system for membership?** If Clerk is auth-gating (users authenticate via Clerk session), then a user can exist in our DB as a member but be unable to log in if not in the Clerk org. For `removeMember`, Clerk removal should remain observable — but WHEN? This determines whether we can tolerate a window where DB says "deactivated" but Clerk still shows them as a member.

2. **Is a background worker feasible in this deployment context?** The project runs as a Next.js app (likely serverless/edge). There is no persistent process. Approach C (outbox) requires one. Approach A requires a webhook receiver (stateless, fine for serverless) but not a worker. This is a deployment constraint that should be confirmed before committing to any async approach.

3. **What is the acceptable UX on partial failure?** For Approach B (saga), if the compensating Clerk call also fails, the user sees a 503. Is that acceptable? Or must the operation always succeed locally even if Clerk is temporarily down?

---

## Recommendation

**Approach B — Saga with compensating transactions**, implemented as DB-first + synchronous compensating calls.

**Why**: It fixes the ordering bug in a single file (`members.service.ts`) with no new infrastructure. The change is:
1. Write to DB first.
2. Call Clerk.
3. If Clerk fails: compensate (re-delete from DB or re-deactivate) and surface the error.

This is achievable without a worker, without a webhook receiver, without new Prisma models, and without Clerk dashboard configuration. It is the smallest surface area that closes F #2 and F #3 completely.

Approach A (DB-first + webhook reconciliation) is architecturally superior at scale but requires greenfield webhook infrastructure that the arquitectura-escalable exploration already deferred. It should be the long-term target, not this change.

Approach C (transactional outbox) requires a persistent worker, which is incompatible with a serverless deployment until a background job runtime is introduced — also deferred per prior exploration.

**Caveat**: The compensating call for `removeMember` (re-adding the user to the Clerk org after a failed deactivation) must handle the case where the DB update partially wrote. This needs careful design in the spec phase.

---

## Relevant File Paths

- `features/organizations/members.service.ts` — the only file with the bug
- `features/organizations/organizations.repository.ts:133-207` — `addMember`, `deactivateMember`, `reactivateMember`
- `features/organizations/__tests__/members.service.test.ts` — existing tests (need Clerk-ordering scenarios added)
- `app/api/organizations/[orgSlug]/members/route.ts` — `POST` caller
- `app/api/organizations/[orgSlug]/members/[memberId]/route.ts` — `DELETE` caller
- `app/api/organizations/[orgSlug]/members/__tests__/route.test.ts` — route tests (mock `MembersService`)
- `features/shared/errors.ts` — error class hierarchy; compensating failure needs a new error code or reuse of existing `AppError`
