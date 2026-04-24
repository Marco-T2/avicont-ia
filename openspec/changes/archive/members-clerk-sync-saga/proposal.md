# Proposal: members-clerk-sync-saga

**Date**: 2026-04-23
**Status**: proposed
**Related audit findings**: F #2 (`addMember`), F #3 (`removeMember`)
**Severity**: CRITICAL — cross-system state corruption + silent security hole

---

## 1. Intent

`MembersService` today calls Clerk BEFORE writing to our Postgres DB in both `addMember` (new-member path AND reactivation branch) and `removeMember`. A `Prisma.$transaction` cannot roll back an HTTP call, so any failure of the DB step leaves Clerk and our DB in permanently divergent states — a user can appear authenticated in Clerk but hold no row in `OrganizationMember` (add), or be erased from Clerk yet still `deactivatedAt: null` in our DB (remove). The new-member path additionally **swallows non-duplicate Clerk errors silently and proceeds to the DB write anyway**, which is the inverse bug (Clerk failure → DB inconsistency in the opposite direction). We are deciding NOW because this service is the template every future external-API integration will copy, and the two known callers (`POST /members`, `DELETE /members/[memberId]`) are both production paths.

---

## 2. Scope

### In scope (single file: `features/organizations/members.service.ts`)

| Method / branch | Lines (current file) | What changes |
|-----------------|----------------------|--------------|
| `addMember` — new-member path | 116–147 | Reorder to DB-first; replace silent `catch` with compensating DB delete + error surface |
| `addMember` — reactivation branch | 85–113 | Reorder to DB-first (reactivate local row); compensate by re-deactivating if Clerk fails |
| `removeMember` | 184–219 | Reorder to DB-first (`deactivateMember`); compensate by `reactivateMember` if Clerk fails |
| `isClerkDuplicateError` helper | 13–17 | Keep; extended use in compensation branches to treat "not found / already gone" as success for `deleteOrganizationMembership` |

Adjacent files that must change to support the above:

- `features/organizations/__tests__/members.service.test.ts` — add Clerk-ordering scenarios per the failure matrix in §3.
- `features/shared/errors.ts` — add a single new subclass `ExternalSyncError extends AppError` for the double-failure case (carries an operator-reconciliation marker; maps to HTTP 503).
- `app/api/organizations/[orgSlug]/members/route.ts` + `[memberId]/route.ts` — only if the new `ExternalSyncError` needs explicit HTTP mapping at the route layer; otherwise existing `AppError` handling suffices.

### Out of scope (explicit)

| Item | One-line justification |
|------|------------------------|
| `updateRole` | Verified LOCAL-ONLY: `organizations.repository.ts:176` (`updateMemberRole`) is pure Prisma; the service method (lines 149–182) makes zero Clerk calls. Role in our DB is the sole permissions authority. |
| `listMembers` | Read-only, no state mutation. |
| Clerk webhook ingestion | No webhook endpoint exists today; greenfield infra deferred per `openspec/changes/arquitectura-escalable/exploration.md:91`. Out of scope here. |
| Transactional outbox / background worker | No worker runtime in this app (see §3 deployment context); deferred by prior exploration. |
| Daily reconciliation job | No scheduler infra; out of scope. Operator reconciliation is manual for the residual double-failure window. |
| Clerk SDK upgrades | Pin stays at `@clerk/nextjs ^7.0.7`. |
| `createOrganization` / `syncOrganization` flows | Separate Clerk surface, different failure domain; tracked for a later change. |

---

## 3. Approach

### Deployment context (pre-commitment)

Evidence from the repo:

- `package.json:5-11` — scripts are `next dev` / `next build` / `next start`. No worker, no queue, no cron runner.
- `package.json` deps — no `bull`, `pg-boss`, `inngest`, `temporal`, `agenda`, `bee-queue`, `svix`, `redis`. `@clerk/nextjs ^7.0.7` is the only Clerk dep.
- `next.config.ts` — only `headers` + `redirects`; no runtime pinning, no rewrites to a worker.
- `app/api/**/route.ts` — every heavy route explicitly declares `export const runtime = "nodejs"` (e.g. `app/api/organizations/[orgSlug]/trial-balance/route.ts:11`, `.../financial-statements/income-statement/route.ts:9`, `.../worksheet/route.ts:11`, `.../journal/[entryId]/route.ts:12`). No route declares `runtime = "edge"`. No cron file, no `vercel.json`, no `fly.toml`, no `Procfile`.
- Test setup is vitest + jsdom (`vitest.config.ts`).

**Conclusion**: this is a **stateless, request-scoped Next.js app on the Node.js runtime**, serverless-compatible (every handler runs to completion within a single HTTP lifetime and cannot assume a persistent process between requests). This kills Approach C (outbox worker) and confirms Approach B (saga inside the request) as the only approach we can ship without new infra.

### Committed approach: Saga with synchronous compensating transactions

**Order of operations** (same shape for all three bug sites):

1. **Validate + resolve** — all pre-flight checks (guards, `findMemberById`, `findById` for `clerkOrgId`, `findByEmail`, duplicate detection). No external call, no mutation.
2. **DB step (primary mutation)** — write the authoritative row: `addMember` / `reactivateMember` / `deactivateMember`.
3. **Clerk step** — `createOrganizationMembership` or `deleteOrganizationMembership`.
4. **Compensation on Clerk failure** — immediately undo the DB step in a `try/catch` around the Clerk call. For add: `repo.hardDelete` or `repo.deactivateMember`. For reactivate: `repo.deactivateMember`. For remove: `repo.reactivateMember` with the previous role.

### Failure matrix

| # | DB step | Clerk step | Compensation | Client | Log level |
|---|---------|------------|--------------|--------|-----------|
| (a) | FAIL | not called | n/a | 500 (existing `AppError` mapping) | `error` |
| (b) | OK | FAIL (non-duplicate) | OK | 503 + `ExternalSyncError` with retry hint | `warn` + structured event `members.clerk_sync.compensated` |
| (c) | OK | OK | n/a | 200 | `info` event `members.clerk_sync.committed` |
| (d) | OK | FAIL | FAIL (double failure) | **503 + `ExternalSyncError` carrying a reconciliation marker** | `error` event `members.clerk_sync.divergent` with `organizationId`, `memberId`, `operation`, both underlying errors |

**Duplicate / not-found handling on the Clerk step** — both sides are safe to no-op:

- `createOrganizationMembership` returning a duplicate error code (existing `isClerkDuplicateError`) → treat as success (c).
- `deleteOrganizationMembership` returning 404 / "not found" → treat as success (c). Helper extended to `isClerkNotFoundError` for symmetry.

### Idempotency

Clerk's SDK semantics as we rely on them (to be confirmed in design phase, tracked as risk R-1):

- `createOrganizationMembership(orgId, userId, role)` — duplicate membership returns an error whose code includes `"duplicate"`. We already catch this (`isClerkDuplicateError`), and will keep treating it as success.
- `deleteOrganizationMembership(orgId, userId)` — second call for an already-absent member should return 404. We will treat 404 as success in compensation.
- Retries are therefore safe from the user-retry perspective: repeating the request after a 503 either completes the previously-partial operation or no-ops cleanly.

### Observability

Every branch emits a single structured log with `{ operation: "addMember" | "reactivateMember" | "removeMember", organizationId, memberId|email, branch: "committed" | "compensated" | "divergent", clerkErrorCode?, dbErrorCode? }`. Severity per the matrix above. `divergent` events are the operational signal that manual reconciliation is needed.

---

## 4. Non-goals

- Automatic retry of failed Clerk calls inside the request (rejected: amplifies latency and hides transient issues; the client retry is the retry).
- Webhook reconciliation of Clerk → DB (deferred; no webhook endpoint today).
- Background reconciler for `divergent` events (deferred; no scheduler today). Operators reconcile manually from the log stream.
- Clerk Organizations → local `Organization` sync (different surface, different change).
- Replacing `console.error` with a structured logger globally (only the four new events in this file are structured; broader logger migration is out of scope).

---

## 5. Risks

| # | Risk | Mitigation / Acceptance |
|---|------|-------------------------|
| R-1 | Clerk SDK v7 duplicate-error code or 404 error shape may differ from our `isClerkDuplicateError` assumption, causing compensation to mis-classify. | Design phase nails the exact `error.errors[0].code` values via the Clerk SDK docs; a small contract test fixtures the real error shapes. |
| R-2 | `hardDelete` does not exist on `OrganizationsRepository` today; we're introducing it only for add-compensation. New method = new attack surface (must be `organizationId`-scoped per the repo tenancy convention). | Add `hardDelete(organizationId, memberId)` with the same `organizationId`-scoped WHERE clause as `deactivateMember` (see `organizations.repository.ts:188`); cover with the same tenant-isolation test pattern as the recent `ChatMemoryRepository` fix (`commit ba70077`). |
| R-3 | Double-failure (d) leaves divergent state; users see 503 and may assume the member was not added when in fact the DB row was rolled back AND Clerk may or may not have the membership. | Accept the window: the `ExternalSyncError` message tells the user "Operation could not complete, state is being reconciled — safe to retry in a minute." The `divergent` log is the operator signal. This is the chosen contract (see §6 below). |
| R-4 | Compensation itself performs a DB write inside a request that is about to return 503 — if the Node process is terminated (serverless timeout, lambda OOM) mid-compensation, state is even worse than (d). | Keep compensation strictly synchronous and next-to-the-try-block, no awaits in between. Compensation is a single `await repo.X(...)` call and must not be wrapped in further orchestration. Explicitly excluded: retry loops around compensation. |
| R-5 | The existing swallow-Clerk-errors behavior in the new-member path (line 127–132) is a de facto contract some caller might rely on (e.g., "adding while Clerk is down still succeeds locally"). Flipping it to 503 is a behavior change. | Audit the two routes (`POST /members`, route.ts:46) and their UI consumer before merge; document the behavior change in the spec phase. No frontend retries rely on this today (verified via call graph in explore). |

---

## 6. Double-failure UX contract (committed)

**Chosen**: **503 + `ExternalSyncError` + structured `divergent` log for operator reconciliation.**

- User sees: HTTP 503 with a human message "No se pudo completar la operación. El sistema está reconciliando el estado — podés reintentar en un momento."
- Log: `members.clerk_sync.divergent` at `error` severity, with full context for manual reconciliation via the Clerk dashboard and a `psql` one-liner.
- No automatic daily reconciler (we don't have a scheduler).
- Retry is user-initiated. Because the Clerk step is idempotent (§3 idempotency), a retry either completes cleanly or no-ops.

**Why not the alternatives**:

- *500 + on-demand reconciliation tool*: we would have to build the tool; no operator UI exists. 503 + log is a strictly smaller surface.
- *Accept-the-window + daily reconciler*: we have no scheduler, and "accept the window" silently is what the current bug does — the whole point is to stop silently diverging.

---

## 7. Alternatives considered (from explore)

| Approach | One-line rejection |
|----------|--------------------|
| A — DB-first + Clerk webhook reconciliation | Superior at scale, but requires a greenfield webhook endpoint + `svix` signature verification + Clerk dashboard config; deferred per prior exploration. Right long-term target, wrong change. |
| C — Transactional outbox + background worker | Requires a persistent worker process; this app has none (evidence §3) and background-job infra was deferred. |
| D — Accept + monitoring only | Does not fix the bug — it documents it. Fails the intent. |

Approach B (Saga) wins because it is the only approach that **closes both findings F #2 and F #3 in a single file with no new infrastructure**.

---

## 8. Success criteria

Measurable, testable:

1. **Ordering** — integration test (real Prisma + mocked Clerk SDK): when Clerk `createOrganizationMembership` rejects on the new-member path, the `OrganizationMember` row MUST NOT exist (or, if already written, MUST be hard-deleted by compensation) AND the client MUST receive 503 with `ExternalSyncError`.
2. **Reactivation ordering** — same as (1) for the reactivation branch: on Clerk failure, `deactivatedAt` MUST be re-set to its previous non-null timestamp.
3. **Remove ordering** — integration test: when Clerk `deleteOrganizationMembership` rejects, the `OrganizationMember` row MUST have `deactivatedAt === null` (compensation re-activated it) AND the client MUST receive 503.
4. **No Clerk call on guard failure** — unit test: when `findMemberByEmail` reports an active duplicate, the Clerk SDK mock MUST have zero calls.
5. **Silent-swallow removal** — the existing line 127–132 behavior is removed: when Clerk rejects on the new-member path, the DB row MUST NOT exist.
6. **Idempotent retry** — integration test: after a 503 from (1), calling the same endpoint again with the same inputs returns 200 (Clerk succeeds on retry) and leaves exactly one `OrganizationMember` row.
7. **Observability contract** — for each of the four log events (`committed`, `compensated`, `divergent`, `aborted`), a test asserts the structured fields (`operation`, `organizationId`, `memberId`, `branch`) are present.
8. **No regression on `updateRole`** — existing `members.service.test.ts` passes unchanged.
9. **Tenant isolation preserved** — the new `hardDelete(organizationId, memberId)` repo method follows the `organizationId`-scoped WHERE pattern (per `commit 906a9bd` / `e882d54`); covered by a dedicated cross-org test.

---

## 9. File inventory (final)

- `features/organizations/members.service.ts` — rewrite of all three bug sites.
- `features/organizations/organizations.repository.ts` — add `hardDelete(organizationId, memberId)`.
- `features/organizations/__tests__/members.service.test.ts` — add scenarios 1–8.
- `features/organizations/__tests__/organizations.repository.tenant-isolation.test.ts` (or equivalent existing file) — cover `hardDelete` cross-org isolation.
- `features/shared/errors.ts` — add `ExternalSyncError`.
- `app/api/organizations/[orgSlug]/members/route.ts` — map `ExternalSyncError` → 503 if not already handled by generic `AppError` mapper.
- `app/api/organizations/[orgSlug]/members/[memberId]/route.ts` — same.

End.
