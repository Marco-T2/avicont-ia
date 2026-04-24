# Tasks: members-clerk-sync-saga

**Change**: members-clerk-sync-saga
**Date**: 2026-04-23
**Total tasks**: 13 | **RED**: 5 | **GREEN**: 5 | **Supporting (contract / infra / suite)**: 3

---

## Overview

Ordering: contract fixtures first → error types → classifiers → saga helper (RED→GREEN) → repo hardening → service rewires per operation (RED→GREEN each) → route guard smoke tests → full regression.

Sensitivity flags addressed:
- **SF-1** (Clerk code strings unverified): T1 is the blocking contract-capture task.
- **SF-2** (`reactivateMember` signature change): T3 (repo hardening) includes caller grep + safe signature extension.
- **SF-3** (`retryAfterSeconds` in JSON body, not header): enforced in T4 RED assertion plan + T6/T7/T8 RED plans; no route `Retry-After` header confirmed clean.

---

## Task List

---

### T1 — Contract: capture and commit real Clerk error fixtures

**Type**: Supporting (contract-capture)
**Goal**: Capture real `ClerkAPIResponseError` JSON shapes from the live Clerk API into committed fixture files, then write contract tests asserting classifiers return expected values for each fixture.

**Files**:
- `features/organizations/__tests__/clerk-error-contract.test.ts` (NEW)
- `features/organizations/__tests__/__fixtures__/clerk-duplicate-membership.json` (NEW)
- `features/organizations/__tests__/__fixtures__/clerk-membership-not-found.json` (NEW)
- `features/organizations/__tests__/__fixtures__/clerk-rate-limit.json` (NEW)

**Spec scenarios satisfied**: S-MCS.1-5, S-MCS.2-5, S-MCS.3-5 (classifier correctness is a precondition for all idempotency paths)

**Commit message subject**:
```
test(members): capture Clerk error fixtures and write classifier contract tests
```

**Commit body** (canonical rule — contract-test prerequisite per design R-1 / SF-1):
> Captures real `ClerkAPIResponseError` shapes for duplicate-membership (422), membership-not-found (404), and rate-limit (429) from the Clerk dev API. Committed fixtures prevent silent classifier drift on SDK upgrades. Per design §3 R-1 and design §9: apply-phase blocker before merge. Re-run capture procedure in test file header after any `@clerk/nextjs` or `@clerk/backend` version bump.

**Procedure** (recorded in test file header):
1. In a dev Clerk app, call `createOrganizationMembership` twice for the same user to trigger 422; capture `error.toJSON()`.
2. Call `deleteOrganizationMembership` for a non-member to trigger 404; capture.
3. (Optional / stub) Create a synthetic 429 error using the SDK constructor if live 429 is not reproducible.
4. Save each as a JSON fixture. Commit all three before T2.

**Verification**: `pnpm test clerk-error-contract` passes with all three fixture assertions green.

---

### T2 — RED: `ExternalSyncError` + error-code constant (fails before implementation)

**Type**: RED
**Goal**: Write failing tests for `ExternalSyncError extends AppError` with `statusCode: 503`, `EXTERNAL_SYNC_ERROR` code constant, `divergentState` and `retryAfterSeconds` in `details`.

**Files**:
- `features/shared/__tests__/external-sync-error.test.ts` (NEW)

**Spec scenarios satisfied**: S-MCS.4-1, S-MCS.4-2, S-MCS.4-3

**Assertion plan**:
```ts
// S-MCS.4-1
const err = new ExternalSyncError("msg", { divergentState: { dbState: "member_inserted", clerkState: "membership_absent" }, operation: "add", correlationId: "x" });
expect(err.statusCode).toBe(503);
expect(err.code).toBe("EXTERNAL_SYNC_ERROR");
// S-MCS.4-2
expect(err.details.retryAfterSeconds).toBeUndefined();
const errWithRetry = new ExternalSyncError("msg", { ..., retryAfterSeconds: 30 });
expect(errWithRetry.details.retryAfterSeconds).toBe(30);
// S-MCS.4-3
expect(EXTERNAL_SYNC_ERROR).toBe("EXTERNAL_SYNC_ERROR");
// SF-3 guard: assert no "Retry-After" key exists in response headers (handleError integration)
```

**Expected failure mode**: `TypeError: ExternalSyncError is not a constructor` — class does not yet exist in `features/shared/errors.ts`. Import of `EXTERNAL_SYNC_ERROR` also fails.

**Commit message subject**:
```
test(errors): RED — ExternalSyncError 503 class and EXTERNAL_SYNC_ERROR constant
```

---

### T3 — GREEN: implement `ExternalSyncError` + constant in `errors.ts`

**Type**: GREEN
**Goal**: Add `ExternalSyncError`, `EXTERNAL_SYNC_ERROR`, `DivergentState`, and `ExternalSyncErrorDetails` types to `features/shared/errors.ts` under a new `// External Sync` section.

**Files**:
- `features/shared/errors.ts` (MODIFY — add new section; no existing constants touched)

**Spec scenarios satisfied**: S-MCS.4-1, S-MCS.4-2, S-MCS.4-3

**Commit message subject**:
```
feat(errors): add ExternalSyncError class and EXTERNAL_SYNC_ERROR code
```

**Verification**: `pnpm test external-sync-error` — all assertions from T2 green.

---

### T4 — Supporting: implement Clerk error classifiers + saga logger

**Type**: Supporting (infrastructure for saga)
**Goal**: Create `features/organizations/clerk-error-classifiers.ts` with `isClerkDuplicateMembershipError`, `isClerkMembershipNotFoundError`, `clerkRetryAfterSeconds`, `clerkErrorFingerprint`; and `features/organizations/member-clerk-saga.logger.ts` with `logCommitted`, `logCompensated`, `logDivergent`.

**Files**:
- `features/organizations/clerk-error-classifiers.ts` (NEW)
- `features/organizations/member-clerk-saga.logger.ts` (NEW)

**Spec scenarios satisfied**: Precondition for REQ-MCS.1/2/3/5/6 — classifiers used by T5/T6/T7/T8; logger used by T5.

**Notes**:
- Classifiers use the real SDK `isClerkAPIResponseError` guard — not hand-rolled. Closes `aspirational_mock_signals_unimplemented_contract` feedback.
- Contract tests from T1 already exercise classifier correctness.
- `clerkRetryAfterSeconds` reads `err.retryAfter` (SDK field); writes to `details.retryAfterSeconds` (JSON body). Does NOT set `Retry-After` header (SF-3 preserved).

**Commit message subject**:
```
feat(members): add Clerk error classifiers and saga logger utilities
```

**Verification**: T1 contract tests pass with classifiers in place; `pnpm test clerk-error-contract` green.

---

### T5 — RED: `runMemberClerkSaga` helper — four failure-matrix rows (fails before implementation)

**Type**: RED
**Goal**: Write failing unit tests for `runMemberClerkSaga` covering all four outcome branches: (a) both succeed, (b) DB fails, (c) Clerk fails + compensation succeeds, (d) Clerk fails + compensation fails.

**Files**:
- `features/organizations/__tests__/member-clerk-saga.test.ts` (NEW)

**Spec scenarios satisfied**: REQ-MCS.1/2/3 (helper is shared by all three operations); S-MCS.5-1, S-MCS.5-2, S-MCS.5-3 (log contract)

**Assertion plan**:
```ts
// (a) Happy path — result returned, logCommitted called
expect(logCommitted).toHaveBeenCalledOnce();
expect(result).toEqual(mockResult);

// (b) DB fails — bubbles as original error, Clerk mock never called
expect(clerkCall).not.toHaveBeenCalled();
expect(logCommitted).not.toHaveBeenCalled();

// (c) Clerk fails, compensation succeeds — ExternalSyncError, logCompensated fired, logDivergent NOT fired
await expect(runMemberClerkSaga(...)).rejects.toThrow(ExternalSyncError);
expect(logCompensated).toHaveBeenCalledOnce();
expect(logDivergent).not.toHaveBeenCalled();

// (d) Double failure — ExternalSyncError with divergentState, logDivergent fired, logCompensated NOT fired
await expect(runMemberClerkSaga(...)).rejects.toThrow(ExternalSyncError);
const divErr = ... // catch
expect(divErr.details.divergentState).toEqual({ dbState: "member_inserted", clerkState: "membership_absent" });
expect(logDivergent).toHaveBeenCalledOnce();
expect(logCompensated).not.toHaveBeenCalled();
// SF-3: assert ExternalSyncError.details does NOT have a "Retry-After" key (header-level)
```

**Expected failure mode**: `Cannot find module '@/features/organizations/member-clerk-saga'` — file does not exist yet. All four test blocks fail at import time.

**Commit message subject**:
```
test(members): RED — runMemberClerkSaga helper four-branch failure matrix
```

---

### T6 — GREEN: implement `runMemberClerkSaga` helper

**Type**: GREEN
**Goal**: Implement the `runMemberClerkSaga<T>` generic helper in `features/organizations/member-clerk-saga.ts` following the design §2 pseudocode contract.

**Files**:
- `features/organizations/member-clerk-saga.ts` (NEW)

**Spec scenarios satisfied**: REQ-MCS.1/2/3 (all three operations delegate to this helper); S-MCS.5-1, S-MCS.5-2, S-MCS.5-3

**Commit message subject**:
```
feat(members): implement runMemberClerkSaga generic saga helper
```

**Verification**: `pnpm test member-clerk-saga` — all four failure-matrix rows from T5 green.

---

### T7 — Repo hardening: extend `reactivateMember` signature + add `hardDelete`

**Type**: Supporting (repository)
**Goal**: Change `reactivateMember(memberId, role)` → `reactivateMember(organizationId, memberId, role, tx?)` in `OrganizationsRepository`; add `hardDelete(organizationId, memberId)` following the `deleteMany` pattern from `deactivateMember`. Update the single caller in `members.service.ts`.

**Files**:
- `features/organizations/organizations.repository.ts` (MODIFY)
- `features/organizations/members.service.ts` (MODIFY — line 105 caller update, `reactivateMember(existing.id, role)` → `reactivateMember(organizationId, existing.id, role)`)
- `features/organizations/__tests__/organizations.repository.tenant-isolation.test.ts` (NEW or EXTEND — integration tests for `hardDelete` cross-org and `reactivateMember` cross-org)

**Spec scenarios satisfied**: S-MCS.3-3 (compensation calls `reactivateMember(organizationId, memberId, previousRole)`), I-8 compliance; `hardDelete` needed by S-MCS.1-3, S-MCS.1-4

**Sensitivity flag SF-2**: grep confirms single caller (`members.service.ts:105`) — safe to change.

**Commit message subject**:
```
fix(repo): scope reactivateMember by organizationId and add hardDelete method
```

**Commit body**:
> SF-2 from design: `reactivateMember(memberId, role)` was the only tenant-unscoped mutation remaining after commits 906a9bd / e882d54. Extended to `reactivateMember(organizationId, memberId, role, tx?)`. Single caller updated. `hardDelete(organizationId, memberId)` follows the `deleteMany` WHERE-scoped pattern from `deactivateMember`. Both covered by cross-org integration test (I-8). Mock hygiene: `members.service.test.ts` mock for `reactivateMember` updated to match new signature.

**Verification**: `pnpm test organizations.repository.tenant-isolation` green; existing `members.service.test.ts` still passes (mock updated).

---

### T8 — RED: `addMember` new-member saga rewire (fails before implementation)

**Type**: RED
**Goal**: Write failing tests for the `addMember` new-member path: DB-first ordering, `hardDelete` compensation on Clerk error, idempotent success on duplicate, double-failure divergent log.

**Files**:
- `features/organizations/__tests__/members.service.saga.test.ts` (NEW — dedicated saga test file, separate from existing `members.service.test.ts` which covers RBAC guards)

**Spec scenarios satisfied**: S-MCS.1-1, S-MCS.1-2, S-MCS.1-3, S-MCS.1-4, S-MCS.1-5, S-MCS.6-1, S-MCS.6-2

**Assertion plan** (abbreviated):
```ts
// S-MCS.1-2: DB fails — Clerk mock never called
mockRepo.addMember.mockRejectedValueOnce(new Error("db error"));
await expect(service.addMember(...)).rejects.toThrow();
expect(mockClerk.createOrganizationMembership).not.toHaveBeenCalled();

// S-MCS.1-3: Clerk fails, compensation succeeds — 503, hardDelete called
mockClerk.createOrganizationMembership.mockRejectedValueOnce(syntheticClerkApiError({ code: "some_error", status: 500 }));
await expect(service.addMember(...)).rejects.toThrow(ExternalSyncError);
expect(mockRepo.hardDelete).toHaveBeenCalledWith(organizationId, memberId);

// S-MCS.1-4: Double failure — divergentState in error
mockRepo.hardDelete.mockRejectedValueOnce(new Error("db down"));
const err = await service.addMember(...).catch(e => e);
expect(err.details.divergentState).toEqual({ dbState: "member_inserted", clerkState: "membership_absent" });

// S-MCS.1-5: Duplicate — idempotent, 200
mockClerk.createOrganizationMembership.mockRejectedValueOnce(syntheticClerkApiError({ code: "already_a_member_in_organization", status: 422 }));
await expect(service.addMember(...)).resolves.toBeDefined();

// S-MCS.6-1: Non-duplicate error — 503, NOT swallowed
expect(err).toBeInstanceOf(ExternalSyncError);
expect(err.statusCode).toBe(503);
```

**Expected failure mode**: Tests import `members.service.ts` which still has the old Clerk-first flow. `S-MCS.1-2` FAILS because Clerk IS called before DB. `S-MCS.1-3` FAILS because error is swallowed and `ExternalSyncError` is never thrown. `S-MCS.6-1` FAILS for the same swallow reason.

**Commit message subject**:
```
test(members): RED — addMember new-member saga DB-first ordering and compensation
```

---

### T9 — GREEN: rewire `addMember` new-member path to use `runMemberClerkSaga`

**Type**: GREEN
**Goal**: Replace the Clerk-first `addMember` new-member body with a `runMemberClerkSaga` call. Remove the lines 127-132 swallow block (REQ-MCS.6). `dbWrite` = `repo.addMember`, `clerkCall` = `createOrganizationMembership`, `compensate` = `repo.hardDelete`, `isIdempotentSuccess` = `isClerkDuplicateMembershipError`.

**Files**:
- `features/organizations/members.service.ts` (MODIFY — new-member branch)

**Spec scenarios satisfied**: S-MCS.1-1 through S-MCS.1-5, S-MCS.6-1, S-MCS.6-2

**Commit message subject**:
```
fix(members): rewire addMember new-member path to DB-first saga with compensation
```

**Verification**: `pnpm test members.service.saga` — all S-MCS.1-x and S-MCS.6-x scenarios green.

---

### T10 — RED + GREEN: `addMember` reactivation saga rewire

**Type**: RED then GREEN (combined — same file, adjacent scenarios)
**Goal**: RED: write failing tests for reactivation branch (S-MCS.2-1 through S-MCS.2-5). GREEN: rewire reactivation branch to use `runMemberClerkSaga`. `dbWrite` = `repo.reactivateMember(organizationId, memberId, role)`, `clerkCall` = `createOrganizationMembership`, `compensate` = `repo.deactivateMember(organizationId, existing.id)`, `isIdempotentSuccess` = `isClerkDuplicateMembershipError`.

**Files**:
- `features/organizations/__tests__/members.service.saga.test.ts` (EXTEND — add reactivation describe block)
- `features/organizations/members.service.ts` (MODIFY — reactivation branch)

**Spec scenarios satisfied**: S-MCS.2-1, S-MCS.2-2, S-MCS.2-3, S-MCS.2-4, S-MCS.2-5

**RED assertion plan (pre-fix expected failure)**:
- `S-MCS.2-2`: Clerk IS called before DB today (Clerk-first flow). Test asserts `mockClerk` not called — FAILS.
- `S-MCS.2-3`: Clerk rejects non-duplicate; today the error is re-thrown without compensation. Test asserts `repo.deactivateMember` called once for compensation — FAILS.

**Commit message subjects**:
```
test(members): RED — addMember reactivation saga DB-first ordering and compensation
feat(members): rewire addMember reactivation path to DB-first saga with compensation
```

**Verification**: `pnpm test members.service.saga` — all S-MCS.2-x scenarios green (combined with S-MCS.1-x from T9).

---

### T11 — RED + GREEN: `removeMember` saga rewire

**Type**: RED then GREEN (combined)
**Goal**: RED: write failing tests for `removeMember` (S-MCS.3-1 through S-MCS.3-5) including `previousRole` capture assertion. GREEN: rewire `removeMember` to `runMemberClerkSaga`. `dbWrite` = `repo.deactivateMember`, `clerkCall` = `deleteOrganizationMembership`, `compensate` = `repo.reactivateMember(organizationId, memberId, previousRole)`, `isIdempotentSuccess` = `isClerkMembershipNotFoundError`.

**Files**:
- `features/organizations/__tests__/members.service.saga.test.ts` (EXTEND — add removeMember describe block)
- `features/organizations/members.service.ts` (MODIFY — removeMember body; capture `const previousRole = member.role` before `deactivateMember`)

**Spec scenarios satisfied**: S-MCS.3-1, S-MCS.3-2, S-MCS.3-3, S-MCS.3-4, S-MCS.3-5

**RED assertion plan (pre-fix expected failure)**:
- `S-MCS.3-2`: Clerk called before DB today — test asserts Clerk not called when DB fails — FAILS.
- `S-MCS.3-3`: Clerk error swallowed (lines 213-216) — test asserts `ExternalSyncError` thrown — FAILS.
- `S-MCS.3-4`: Same swallow; double-failure path never reached — FAILS.
- `S-MCS.3-5`: Swallow catches all errors including 404 — behavior preserved but test explicitly asserts idempotent 200 via `isClerkMembershipNotFoundError` guard.

**Commit message subjects**:
```
test(members): RED — removeMember saga DB-first ordering and compensation
fix(members): rewire removeMember path to DB-first saga with compensation
```

**Verification**: `pnpm test members.service.saga` — all S-MCS.3-x scenarios green.

---

### T12 — Observability integration: verify log event shapes

**Type**: Supporting (observability cross-cut)
**Goal**: Add `console.info/warn/error` spy assertions to existing saga tests to verify the three log event payloads match REQ-MCS.5 field contract (memberId, clerkUserId, organizationId, operation, dbState, clerkState, correlationId, event name).

**Files**:
- `features/organizations/__tests__/members.service.saga.test.ts` (EXTEND — add `vi.spyOn(console, …)` assertions to double-failure + compensation scenarios)

**Spec scenarios satisfied**: S-MCS.5-1, S-MCS.5-2, S-MCS.5-3

**Notes**:
- These assertions extend the double-failure test bodies from T8/T9/T10/T11 rather than adding new test cases.
- Parse `console.error.mock.calls[0][0]` as JSON; assert all required fields present and non-empty.
- Assert `console.error` (divergent) does NOT fire in compensation-success scenarios.

**Commit message subject**:
```
test(members): assert structured log payload shape for saga observability events
```

**Verification**: Targeted test blocks pass; no new test files.

---

### T13 — Full regression suite

**Type**: Supporting (regression gate)
**Goal**: Run the complete test suite to confirm no regressions in RBAC guards, validation, roles, or other organization flows.

**Files**: none (read-only)

**Commit message subject**: N/A — no code changes.

**Verification**: `pnpm test` exits 0. All pre-existing tests in `members.service.test.ts`, `organizations.service.test.ts`, `roles.*.test.ts`, `members.validation.*.test.ts` still pass.

---

## Cross-Reference Matrix — Spec Scenarios → Tasks

| Scenario | Task(s) |
|----------|---------|
| S-MCS.1-1 (add-new happy) | T8 RED, T9 GREEN |
| S-MCS.1-2 (add-new DB fails) | T8 RED, T9 GREEN |
| S-MCS.1-3 (add-new Clerk fails, comp OK) | T8 RED, T9 GREEN |
| S-MCS.1-4 (add-new double failure) | T8 RED, T9 GREEN |
| S-MCS.1-5 (add-new duplicate idempotent) | T1 contract, T8 RED, T9 GREEN |
| S-MCS.2-1 (reactivate happy) | T10 RED+GREEN |
| S-MCS.2-2 (reactivate DB fails) | T10 RED+GREEN |
| S-MCS.2-3 (reactivate Clerk fails, comp OK) | T10 RED+GREEN |
| S-MCS.2-4 (reactivate double failure) | T10 RED+GREEN |
| S-MCS.2-5 (reactivate duplicate idempotent) | T1 contract, T10 RED+GREEN |
| S-MCS.3-1 (remove happy) | T11 RED+GREEN |
| S-MCS.3-2 (remove DB fails) | T11 RED+GREEN |
| S-MCS.3-3 (remove Clerk fails, comp OK) | T11 RED+GREEN |
| S-MCS.3-4 (remove double failure) | T11 RED+GREEN |
| S-MCS.3-5 (remove 404 idempotent) | T1 contract, T11 RED+GREEN |
| S-MCS.4-1 (ExternalSyncError 503) | T2 RED, T3 GREEN |
| S-MCS.4-2 (retryAfterSeconds in details) | T2 RED, T3 GREEN |
| S-MCS.4-3 (EXTERNAL_SYNC_ERROR constant) | T2 RED, T3 GREEN |
| S-MCS.5-1 (divergent log only on double fail) | T5 RED, T6 GREEN, T12 |
| S-MCS.5-2 (divergent NOT on comp-success) | T5 RED, T6 GREEN, T12 |
| S-MCS.5-3 (divergent payload fields) | T5 RED, T6 GREEN, T12 |
| S-MCS.6-1 (non-duplicate 503, not swallowed) | T8 RED, T9 GREEN |
| S-MCS.6-2 (retry reaches consistent state) | T8 RED, T9 GREEN (integration scenario) |

All 23 spec scenarios mapped. No gaps.
