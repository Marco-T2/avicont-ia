# Verification Report: members-clerk-sync-saga

**Change**: members-clerk-sync-saga
**Date**: 2026-04-23
**Mode**: Strict TDD
**Verifier**: sdd-verify (independent)

---

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 13 |
| Tasks complete | 13 |
| Tasks incomplete | 0 |

All 13 tasks (T1–T13) have evidence in commits and test files. T12 was merged inline into T8/T10/T11 saga test bodies rather than a separate commit — no commit artefact gap, just a structural merge.

---

## Build & Tests Execution

**Build**: N/A (Next.js; no explicit build step required for verification)

**Tests**: ✅ 2802 passed / ❌ 0 failed / ⚠️ 0 skipped
- `pnpm vitest run` → 322 test files, 2802 tests, 0 failures
- Baseline: 2784 (post-round-1) → 2802 (post-round-2). Delta: +18. Matches applier's claim exactly.

**Coverage**: Not collected (not required by spec; threshold not configured)

---

## TDD Compliance (Strict Mode)

| Task | RED commit | GREEN commit | Pairwise? |
|------|-----------|-------------|-----------|
| T2 | 385bc6e | df4161f | ✅ |
| T5 | 14492ab | 59616ca | ✅ |
| T7 | c8fde6c | 01e1c60 | ✅ |
| T8 | 7f1138a | c4b26fc | ✅ |
| T10 | 080f8a1 | 3513523 | ✅ |
| T11 | f590f1d | fdef0cf | ✅ |

T1 (contract), T4 (classifiers+logger), T12 (observability inline) are supporting tasks — no RED required per tasks.md. T13 is a suite run. TDD chain is intact for all RED/GREEN pairs.

RED acceptance headers present in all six RED test files ✅.

---

## Spec Compliance Matrix (Behavioral — test execution evidence)

| Scenario | Test file | Assertion | Status |
|----------|-----------|-----------|--------|
| S-MCS.1-1 (add-new happy) | members.service.add-saga.test.ts | result DTO + Clerk called + no divergent log | ✅ REALIZED |
| S-MCS.1-2 (add-new DB fails → no Clerk) | members.service.add-saga.test.ts | Clerk mock not called | ✅ REALIZED |
| S-MCS.1-3 (add-new Clerk fail → compensation) | members.service.add-saga.test.ts | ExternalSyncError 503 + hardDelete called + compensated log | ✅ REALIZED |
| S-MCS.1-4 (add-new double failure) | members.service.add-saga.test.ts | divergentState + logDivergent exactly once | ✅ REALIZED |
| S-MCS.1-5 (add-new duplicate idempotent) | members.service.add-saga.test.ts | resolves DTO, no hardDelete, no compensated/divergent | ✅ REALIZED |
| S-MCS.2-1 (reactivate happy) | members.service.add-saga.test.ts | reactivateMember called, Clerk called, returns DTO | ✅ REALIZED |
| S-MCS.2-2 (reactivate DB fails → no Clerk) | members.service.add-saga.test.ts | Clerk mock not called | ✅ REALIZED |
| S-MCS.2-3 (reactivate Clerk fail → compensation) | members.service.add-saga.test.ts | ExternalSyncError + deactivateMember compensation + compensated log | ✅ REALIZED |
| S-MCS.2-4 (reactivate double failure) | members.service.add-saga.test.ts | divergentState + divergent log + no compensated log | ✅ REALIZED |
| S-MCS.2-5 (reactivate duplicate idempotent) | members.service.add-saga.test.ts | resolves DTO, no compensation | ✅ REALIZED |
| S-MCS.3-1 (remove happy) | members.service.remove-saga.test.ts | deactivateMember called, Clerk delete called, no reactivateMember | ✅ REALIZED |
| S-MCS.3-2 (remove DB fails → no Clerk) | members.service.remove-saga.test.ts | Clerk mock not called | ✅ REALIZED |
| S-MCS.3-3 (remove Clerk fail → compensation) | members.service.remove-saga.test.ts | ExternalSyncError + reactivateMember(org, memberId, previousRole) + compensated log | ✅ REALIZED |
| S-MCS.3-4 (remove double failure) | members.service.remove-saga.test.ts | divergentState(db=deactivated,clerk=present) + divergent log | ✅ REALIZED |
| S-MCS.3-5 (remove 404 idempotent) | members.service.remove-saga.test.ts | resolves, no reactivateMember | ✅ REALIZED |
| S-MCS.4-1 (ExternalSyncError 503) | external-sync-error.test.ts | handleError → 503, code=EXTERNAL_SYNC_ERROR | ✅ REALIZED |
| S-MCS.4-2 (retryAfterSeconds in details) | external-sync-error.test.ts | details.retryAfterSeconds=30, no Retry-After header | ✅ REALIZED |
| S-MCS.4-3 (EXTERNAL_SYNC_ERROR constant) | external-sync-error.test.ts | value === "EXTERNAL_SYNC_ERROR" | ✅ REALIZED |
| S-MCS.5-1 (divergent log only on double fail) | member-clerk-saga.test.ts + saga service tests | logDivergent spy asserted 0 times on single-failure | ✅ REALIZED |
| S-MCS.5-2 (divergent NOT on comp-success) | member-clerk-saga.test.ts + saga service tests | logDivergent spy not called on compensation-success paths | ✅ REALIZED |
| S-MCS.5-3 (divergent payload schema) | member-clerk-saga.test.ts + saga service tests | JSON payload asserted: event, operation, organizationId, memberId, clerkUserId, dbState, clerkState, correlationId | ✅ REALIZED |
| S-MCS.6-1 (non-duplicate 503, not swallowed) | members.service.add-saga.test.ts | ExternalSyncError thrown, hardDelete called | ✅ REALIZED |
| S-MCS.6-2 (retry reaches consistent state) | members.service.add-saga.test.ts | Unit proxy: hardDelete assertion proves row removal; real DB integration ABSENT | ⚠️ PARTIAL |

**Compliance summary**: 22/23 fully REALIZED, 1 PARTIAL (S-MCS.6-2 integration).

---

## Correctness (Static — Structural Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| REQ-MCS.1 addMember new-member saga | ✅ Implemented | `members.service.ts`: `runMemberClerkSaga` with `dbWrite=addMember`, `compensate=hardDelete`, `isIdempotentSuccess=isClerkDuplicateMembershipError` |
| REQ-MCS.2 addMember reactivation saga | ✅ Implemented | Same helper; `dbWrite=reactivateMember(org,id,role)`, `compensate=deactivateMember` |
| REQ-MCS.3 removeMember saga | ✅ Implemented | `dbWrite=deactivateMember`, `compensate=reactivateMember(org,id,previousRole)`; previousRole captured pre-flight |
| REQ-MCS.4 ExternalSyncError class | ✅ Implemented | `errors.ts` §External Sync: `ExternalSyncError extends AppError`, 503, `EXTERNAL_SYNC_ERROR` constant |
| REQ-MCS.5 Structured observability | ✅ Implemented | `member-clerk-saga.logger.ts`: logCommitted/logCompensated/logDivergent; divergent ONLY on double-failure |
| REQ-MCS.6 Silent-fail elimination | ✅ Implemented | Old swallow catch (lines 127-132) completely replaced; grep confirms ZERO `catch` blocks in members.service.ts |

---

## Coherence (Design Match)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Saga helper in `features/organizations/` (not shared) | ✅ Yes | `member-clerk-saga.ts` in organizations, not features/shared |
| `runMemberClerkSaga<T>({ctx, dbWrite, clerkCall, compensate, isIdempotentSuccess, divergentState})` | ✅ Yes | Exact signature match with design §2 |
| `ExternalSyncError` in `errors.ts` `// External Sync` section | ✅ Yes | New section, additive, no existing constants touched |
| No route-level changes (I-5) | ✅ Yes | Zero route files modified |
| `hardDelete` uses `deleteMany` (idempotent) | ✅ Yes | `organizations.repository.ts`: `deleteMany` with `where: {id, organizationId}` |
| `reactivateMember(organizationId, memberId, role, tx?)` | ✅ Yes | Signature extended; single caller updated |
| No Retry-After HTTP header (SF-3) | ✅ Yes | Test asserts `response.headers.get("Retry-After") === null` |
| Clerk mock uses real SDK constructor | ✅ Yes | `ClerkAPIResponseError` from `@clerk/shared/error` used throughout |
| `previousRole` captured from `findMemberById` BEFORE deactivation | ✅ Yes | `members.service.ts` line 293: `const previousRole = member.role` |
| No webhook / outbox / scheduler | ✅ Yes | No such infrastructure added |
| S-MCS.6-2 requires real-DB integration test | ⚠️ Deviated | Design §7 marks this as integration-only; apply used unit-level proxy |

---

## Issues Found

**CRITICAL**: None

**WARNING**:

1. **S-MCS.6-2 missing real-DB integration test** (`openspec/changes/members-clerk-sync-saga/design.md §7`, spec.md S-MCS.6-2)
   Design §7 scenario → style map explicitly assigned S-MCS.6-2 to "integration (real DB)" with rationale "Real `hardDelete` must actually remove the row; re-invoke service with the same inputs." The apply-progress claims 23/23 scenarios covered but only unit-level proxy coverage exists for S-MCS.6-2 (asserting `hardDelete` was called, not that re-invocation actually succeeds with no conflicting row). No test exists that runs real Prisma, inserts a member, calls `hardDelete`, then re-adds and verifies exactly one row. The scenario is PARTIAL at the integration layer.
   - Risk: compensation could be structurally correct (deleteMany called) but silently produce count=0 if the WHERE clause is wrong; the unit test would still pass because it mocks the repo.
   - Files affected: `features/organizations/__tests__/` — no integration test for S-MCS.6-2.

2. **SF-1 fixtures are synthesized, not live-captured** (`clerk-error-contract.test.ts` header comment)
   The contract-test header explicitly documents this and provides a re-capture procedure. The risk is live Clerk API might return different `code` strings than assumed. Correctly escalated in apply-progress and test file header. Classified WARNING (not CRITICAL) because: (a) the classifier has three-tier fallback including substring match; (b) the contract test will catch drift on the next SDK bump; (c) the escalation is documented. This is an accepted risk per design R-1.
   - File: `features/organizations/__tests__/clerk-error-contract.test.ts`

**SUGGESTION**:

1. The T12 observability cross-cut was merged inline into T8/T10/T11 saga tests (no separate T12 commit). This is structurally fine — all assertions exist — but the `apply-progress.md` "no new commit" note for T12 means the task-trail shows no `test(members): assert structured log payload shape` commit. Not a blocker; the observability assertions ARE present.

2. The `DEACTIVATED_MEMBER` object in `members.service.add-saga.test.ts` uses a stub `user: USER_DB` field for the `DEACTIVATED_MEMBER` shape (needed for `existing.user.name` and `existing.user.email` in the reactivation DTO). This is correct but slightly fragile — if `findMemberByEmail` changes its return shape, tests would fail at mock setup, not at assertion. Minor test brittleness only.

---

## Baseline Protection

| Check | Result |
|-------|--------|
| Test count before saga | 2784 (post-round-1), 2739 (original) |
| Test count after saga | 2802 (2802 confirmed by actual run) |
| Delta | +18 (matches applier claim) |
| Regressions | 0 |
| F#4/F#5 invariant (tx.ivaPurchaseBook.update inside regenerateJournalForIvaChange) | ZERO — guard comments at lines 1130 and 977 are in a *different* method; actual `tx.ivaPurchaseBook.update` at line 1317 is in a distinct code path |

---

## Out-of-Scope Guard

- `updateRole` — confirmed: no Clerk calls, method body is a pure `repo.updateMemberRole` call with DB-only logic. ✅
- No webhook / outbox / reconciler added. ✅
- No `Retry-After` HTTP header path added. ✅

---

## Commit Hygiene

| Check | Result |
|-------|--------|
| Co-Authored-By / AI attribution | ZERO |
| --no-verify usage | ZERO |
| RED before GREEN (all pairs) | ✅ All 6 RED/GREEN pairs correctly ordered |
| Conventional commits | ✅ All 14 commits follow `type(scope): subject` |
| Rule citations in commit bodies (T7, T11, T10, T9) | ✅ Present with cross-refs and rationale |
| Mock hygiene named in T11 RED commit body | ✅ Explicitly named |

---

## Verdict

**PASS WITH WARNINGS**

All 22 directly unit-testable spec scenarios REALIZED with passing tests. Baseline protected (2802/322, zero failures). Zero CRITICAL findings. Two WARNINGs:

1. S-MCS.6-2 integration test absent — unit proxy only; real-DB proof that `hardDelete` + re-add reaches consistent state is not exercised.
2. SF-1 Clerk fixtures are synthesized, not live-captured — documented risk, accepted in apply-progress, re-capture procedure present.

Implementation is structurally sound, design coherent, TDD chain intact, silent-fail fully eliminated, observability correct.
