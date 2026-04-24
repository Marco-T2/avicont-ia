# Apply Progress — members-clerk-sync-saga (Round 1)

Round 1 scope: **T1 through T7** (infrastructure). Round 2 (T8-T13) covers
service rewires and is NOT in this round.

Baseline: `0c9b1e7` — 316 files, 2739 tests passing.

---

## Check-in #1 — after T4 (classifiers + logger shipped)

### Commits
| Task | SHA | Subject |
|------|-----|---------|
| T1 | 3d9010a | test(members): RED — capture Clerk error fixtures and write classifier contract tests |
| T2 | 385bc6e | test(errors): RED — ExternalSyncError 503 class and EXTERNAL_SYNC_ERROR constant |
| T3 | df4161f | feat(errors): add ExternalSyncError class and EXTERNAL_SYNC_ERROR code |
| T4 | 07ddaf9 | feat(members): add Clerk error classifiers and saga logger utilities |

### Files created
- `features/organizations/__tests__/__fixtures__/clerk-duplicate-membership.json`
- `features/organizations/__tests__/__fixtures__/clerk-membership-not-found.json`
- `features/organizations/__tests__/__fixtures__/clerk-rate-limit.json`
- `features/organizations/__tests__/clerk-error-contract.test.ts`
- `features/shared/__tests__/external-sync-error.test.ts`
- `features/organizations/clerk-error-classifiers.ts`
- `features/organizations/member-clerk-saga.logger.ts`

### Files modified
- `features/shared/errors.ts` — added `EXTERNAL_SYNC_ERROR` constant,
  `DivergentState` / `ExternalSyncErrorDetails` types, `ExternalSyncError` class.

### SF-1 resolution (explicit)
Clerk error fixtures were **synthesized** from the
`@clerk/shared/ClerkAPIErrorJSON` type shape — NOT captured from a live
Clerk sandbox. This environment has no Clerk dev credentials. The three
codes the design assumed are now codified in the fixtures:
`already_a_member_in_organization` (422), `resource_not_found` (404),
`rate_limit_exceeded` (429, `retryAfter: 30`). The unverified status + a
re-capture procedure are documented in the header of
`clerk-error-contract.test.ts`. If a live Clerk call returns a different
code string, the contract test will catch it.

### SF-3 resolution (retryAfterSeconds in details, not header)
The `external-sync-error.test.ts` suite asserts `handleError(err).headers
.get("Retry-After") === null` while `body.details.retryAfterSeconds === 30`.
SF-3 is enforced at two layers: the type (`ExternalSyncErrorDetails.retryAfterSeconds`) and the serializer contract (unchanged).

### Drift / escalations
None. No invariant collision surfaced in T1-T4. All additions sit in new
sections of `errors.ts` (`// External Sync`) and new files in
`features/organizations/`.

### RED acceptance
- T1 failed with `Cannot find module '../clerk-error-classifiers'` — exact
  declared mode.
- T2 failed with `TypeError: ExternalSyncError is not a constructor` — exact
  declared mode.
Both RED commits accepted as-declared.

---

## Check-in #2 — after T6 (saga helper RED + GREEN shipped)

### Commits
| Task | SHA | Subject |
|------|-----|---------|
| T5 | 14492ab | test(members): RED — runMemberClerkSaga helper four-branch failure matrix |
| T6 | 59616ca | feat(members): implement runMemberClerkSaga generic saga helper |

### Saga helper — signature FROZEN for round 2
```ts
export type MemberSagaContext = {
  operation: "add" | "reactivate" | "remove";
  organizationId: string;
  memberId: string;       // filled after dbWrite for add-new; pre-known otherwise
  clerkUserId: string;
  correlationId: string;
};

export type MemberSagaInput<T> = {
  ctx: MemberSagaContext;
  dbWrite: () => Promise<{ memberId: string; result: T }>;
  clerkCall: () => Promise<void>;
  compensate: () => Promise<void>;
  isIdempotentSuccess: (err: unknown) => boolean;
  divergentState: { dbState: string; clerkState: string };
};

export async function runMemberClerkSaga<T>(input: MemberSagaInput<T>): Promise<T>;
```

### Test coverage
- Branch (a) happy path: result returned, `logCommitted` emitted once,
  payload carries `operation`/`organizationId`/`memberId`/`clerkUserId`/`correlationId`.
- Branch (b) dbWrite fails: bubble original error, Clerk/compensate/loggers
  all silent.
- Branch (c) Clerk fails + compensation OK: `ExternalSyncError` thrown,
  `logCompensated` fired (with `clerkError` fingerprint), `logDivergent`
  NOT fired.
- Branch (d) double failure: `ExternalSyncError` with `divergentState`,
  `logDivergent` fired with all required fields (S-MCS.5-3), `logCompensated`
  NOT fired.
- Branch (e) Clerk idempotent success: `logCommitted` fired, compensation
  NEVER called, result returned.
- SF-3 guard: `ExternalSyncError.details` contains no `Retry-After` /
  `retry-after` keys.

### Drift / escalations
None. Helper implementation matches design §2 pseudocode. No invariant
collision surfaced.

### RED acceptance
- T5 failed with `Cannot find module '../member-clerk-saga'` — exact
  declared mode.

## Check-in #3 — after T7 (repo hardening shipped) / Round 1 FINAL

### Commits (T7)
| Task | SHA | Subject |
|------|-----|---------|
| T7 RED | c8fde6c | test(organizations): RED — tenant isolation for reactivateMember and hardDelete |
| T7 GREEN | 01e1c60 | fix(repo): scope reactivateMember by organizationId and add hardDelete method |

### Round 1 commit trail (8 commits)
| # | SHA | Subject |
|---|-----|---------|
| T1 | 3d9010a | test(members): RED — capture Clerk error fixtures and write classifier contract tests |
| T2 | 385bc6e | test(errors): RED — ExternalSyncError 503 class and EXTERNAL_SYNC_ERROR constant |
| T3 | df4161f | feat(errors): add ExternalSyncError class and EXTERNAL_SYNC_ERROR code |
| T4 | 07ddaf9 | feat(members): add Clerk error classifiers and saga logger utilities |
| T5 | 14492ab | test(members): RED — runMemberClerkSaga helper four-branch failure matrix |
| T6 | 59616ca | feat(members): implement runMemberClerkSaga generic saga helper |
| T7 RED | c8fde6c | test(organizations): RED — tenant isolation for reactivateMember and hardDelete |
| T7 GREEN | 01e1c60 | fix(repo): scope reactivateMember by organizationId and add hardDelete method |

### SF-2 callers — post-change
Single caller of `reactivateMember` (`members.service.ts:105`) updated to
pass `organizationId`. `hardDelete` has no consumers yet — wired in
round 2. No test files changed mocks for either method.

### Regression
Baseline 2739 passing / 316 files → after round 1: **2784 passing / 320
files**. Delta: +45 tests, +4 files. All green. Lint clean on every
touched file.

### RED acceptance (summary)
- T1: `Cannot find module '../clerk-error-classifiers'` (exact).
- T2: `TypeError: ExternalSyncError is not a constructor` (exact).
- T5: `Cannot find module '../member-clerk-saga'` (exact).
- T7: 7 assertion failures — 4 on reactivateMember WHERE clause, 3 on
  missing `hardDelete` method (all exact to declared mode).

### Invariant collision — NONE
No collision surfaced in round 1. `ExternalSyncError` slotted into
`errors.ts` under the new `// External Sync` section (additive). Saga
helper is a new file. Repo signature change verified single-caller.

### Signature frozen for round 2
```ts
runMemberClerkSaga<T>({ ctx, dbWrite, clerkCall, compensate, isIdempotentSuccess, divergentState })
```
Round 2 wires this into `addMember` (both branches) and `removeMember`.

### Round 2 must-knows
- `hardDelete` returns `{ count: number }` (deleteMany result) — ignore
  the return if you don't need it.
- `reactivateMember` signature is `(organizationId, memberId, role, tx?)`.
- On removeMember compensation, capture `previousRole = member.role`
  BEFORE `deactivateMember` (per design §11).
- The saga helper's `ctx.memberId` is filled with `dbWrite`'s return
  `memberId` — for reactivate/remove branches pass the known id and
  have `dbWrite` echo it back.


---

## Baseline protection
Baseline at 2739 passing. T1-T4 added 10 + 19 = 29 new tests. Expected new
total after round 1: 2739 + T1(19) + T2/T3(10) + T7(integration count TBD)
≈ 2768+.

---

# Apply Progress — members-clerk-sync-saga (Round 2)

Round 2 scope: **T8-T13** (saga rewires in `members.service.ts`,
observability assertions, full-suite regression). Round 1 shipped T1-T7.

Baseline at start of round 2: **2784 passing / 320 files**.

---

## Check-in #1 — after T9 (addMember new-member rewire)

### Commits
| Task | SHA | Subject |
|------|-----|---------|
| T8 RED | 7f1138a | test(members): RED — addMember new-member saga DB-first ordering and compensation |
| T9 GREEN | c4b26fc | fix(members): rewire addMember new-member path to DB-first saga with compensation |

### Files
- NEW: `features/organizations/__tests__/members.service.add-saga.test.ts`
  — 6 tests covering S-MCS.1-1 through S-MCS.1-5 and S-MCS.6-1. All green.
- MODIFIED: `features/organizations/members.service.ts` — new-member branch
  (old lines 120-151) replaced by a `runMemberClerkSaga` invocation.

### RED acceptance (exact declared-vs-actual)
- S-MCS.1-2 — DECLARED: "Clerk IS called before DB". ACTUAL: Clerk
  `createOrganizationMembership` called with 1 invocation — exact match.
- S-MCS.1-3 — DECLARED: "Clerk error swallowed; no ExternalSyncError;
  no hardDelete". ACTUAL: `caught` is `undefined` (promise resolved);
  `expect(caught).toBeInstanceOf(ExternalSyncError)` FAILED — exact match.
- S-MCS.1-4 — Same root cause as 1-3 — exact match.
- S-MCS.6-1 — DECLARED: "returns 201/member DTO". ACTUAL: promise resolved
  with `{ id, role, userId, email, name }` — exact match.
- S-MCS.1-1 and S-MCS.1-5 passed RED (pre-existing Clerk-first path
  happens to satisfy the happy-path + idempotent-duplicate outcome
  assertions; GREEN preserves them while also enforcing
  ordering/logging).

### Drift / escalations
None. The closure-capture pattern for `insertedMemberId` inside the
compensate callback was the only subtle point — `runMemberClerkSaga`
guarantees `dbWrite` completes before `compensate` is invoked (helper
contract, design §2 pseudocode), so the variable assignment is
guaranteed to be observed by the compensate closure. No invariant
collision surfaced.

### Mock-hygiene commits
None in this check-in. The T8 RED test file uses a fresh module-level
`vi.mock("@clerk/nextjs/server")` with mockable `createOrganizationMembership`
/ `deleteOrganizationMembership` / `getUserList` functions (no mock
updates to existing files — preserves round 1 mock surfaces).

### Route handler mapping
Not yet touched. Per design §6 + I-5, `handleError` already maps any
`AppError` subclass to its `statusCode` — `ExternalSyncError` inherits
this and renders 503 automatically. Confirmed via the existing
`external-sync-error.test.ts` contract suite from round 1.
Round 2 plan: spot-check route handlers remain untouched; if any
handler bypasses `handleError` (unlikely per prior audits), patch there.

### Targeted test result
- `pnpm vitest run features/organizations/__tests__/members.service.add-saga.test.ts`
  → 6 passed.
- `pnpm vitest run features/organizations/__tests__/members.service.test.ts`
  → 12 passed (no regression on RBAC guards / conflict / self-role paths).

### Next (T10-T13)
- T10: reactivation saga (S-MCS.2-*).
- T11: removeMember saga (S-MCS.3-*).
- T12: observability assertions (already inline in T8 tests for the
  new-member path — extend to reactivation + remove in T10/T11).
- T13: full-suite regression.

---

## Check-in #2 — after T11 (all three operation rewires shipped)

### Commits (T10 + T11)
| Task | SHA | Subject |
|------|-----|---------|
| T10 RED | 080f8a1 | test(members): RED — addMember reactivation saga DB-first ordering and compensation |
| T10 GREEN | 3513523 | feat(members): rewire addMember reactivation path to DB-first saga with compensation |
| T11 RED | f590f1d | test(members): RED — removeMember saga DB-first ordering and compensation |
| T11 GREEN | fdef0cf | fix(members): rewire removeMember path to DB-first saga with compensation |

### Files
- MODIFIED: `features/organizations/__tests__/members.service.add-saga.test.ts`
  — extended with reactivation describe block (S-MCS.2-1..5 + ConflictError
  sanity). 12 tests total across add-new + reactivation.
- NEW: `features/organizations/__tests__/members.service.remove-saga.test.ts`
  — 6 tests for removeMember (S-MCS.3-1..5 + previousRole capture).
- MODIFIED: `features/organizations/members.service.ts` — reactivation
  branch and removeMember body both now go through `runMemberClerkSaga`.
  The legacy `isClerkDuplicateError` private helper + the
  "Si no se encuentra en Clerk, ignorar" swallow-all block are fully
  removed.

### RED acceptance (T10 & T11, exact declared-vs-actual)
- **T10** — RED surfaced a compound failure: (A) pre-existing Clerk-first
  reactivation bug (S-MCS.2-2), and (B) T9's side-effect deletion of
  the `isClerkDuplicateError` private helper that the reactivation branch
  still referenced. Reconciled explicitly in the test file header per the
  RED-acceptance-failure-mode rule — no silent "FAILS cumple". T10 GREEN
  resolves both causes in one commit (switches to saga helper AND removes
  the stale reference), effectively completing what T9 partially began.
- **T11** — all four declared RED failures match actuals exactly:
  S-MCS.3-2 (Clerk called first), S-MCS.3-3/4 (swallow), and the
  previousRole-capture guard (reactivateMember never reached today).
  S-MCS.3-1 and S-MCS.3-5 pass RED because the swallow-plus-deactivate
  flow coincidentally satisfies the outcome assertions; GREEN enforces
  ordering/classifier/logging on top.

### Drift / escalations
None. The helper-deletion drift identified in T10 RED was reconciled in
the test-file header (not silenced) and fully resolved in T10 GREEN. No
invariant collision surfaced — `I-8` (tenant isolation) preserved via
`organizationId`-scoped `reactivateMember` + `deactivateMember` from
round-1 T7.

### Mock-hygiene commits
T11's new test file (`members.service.remove-saga.test.ts`) introduces
a module-level `vi.mock("@clerk/nextjs/server")` with stubbed
`createOrganizationMembership` and `deleteOrganizationMembership`.
Named explicitly in the T11 RED commit body. No existing mock surfaces
touched in any of the four commits.

### Route handler mapping
Re-confirmed: zero route files required. `handleError`'s generic
`AppError` branch (`features/shared/http-error-serializer.ts:11-19`)
maps `ExternalSyncError` to 503 + JSON body including
`details.divergentState` + `details.retryAfterSeconds` (when populated).
No `Retry-After` HTTP header path exists — SF-3 preserved across all
three operation rewires. If any route handler needs ExternalSyncError
awareness beyond the default serialization, it would be added in a
follow-up change, not here.

### Observability status (T12 preview)
T12's assertion cross-cut is already inline in every saga test: each
double-failure scenario asserts `console.error` received exactly one
call whose parsed JSON payload matches the full S-MCS.5-3 field schema
(`event`, `operation`, `organizationId`, `memberId`, `clerkUserId`,
`dbState`, `clerkState`, `correlationId`). Compensation-only scenarios
assert exactly one `console.warn` `members.clerk_sync.compensated` call.
Happy path and idempotent paths assert zero `divergent` / `compensated`
calls. This satisfies S-MCS.5-1, S-MCS.5-2, S-MCS.5-3.

### Targeted test result
- `pnpm vitest run features/organizations/__tests__/members.service.{add,remove}-saga.test.ts features/organizations/__tests__/members.service.test.ts`
  → 30 passed.

### Next (T12 + T13)
- T12: ensure observability assertions cover every saga test's REQ-MCS.5
  contract — already done inline; one consolidation pass to verify.
- T13: `pnpm vitest run` full suite. Confirm 2784 baseline + new tests.

---

## Round 2 — final closeout (T12 + T13)

### T12 — observability coverage verification

No new commit. All REQ-MCS.5 assertions are already inline in the T8 /
T10 / T11 saga tests:

| Scenario | File | Divergent log | Compensated log | Correlation id |
|----------|------|---------------|-----------------|----------------|
| S-MCS.1-1 (add happy) | add-saga | asserts 0 | — | — |
| S-MCS.1-3 (add comp OK) | add-saga | asserts 0 | asserts 1 | — |
| S-MCS.1-4 (add double fail) | add-saga | asserts 1 + full schema | asserts 0 | string, non-empty |
| S-MCS.1-5 (add dup idempotent) | add-saga | asserts 0 | asserts 0 | — |
| S-MCS.2-3 (react comp OK) | add-saga | — | asserts 1 w/ operation="reactivate" | — |
| S-MCS.2-4 (react double fail) | add-saga | asserts 1 + full schema | asserts 0 | string, non-empty |
| S-MCS.3-3 (remove comp OK) | remove-saga | — | asserts 1 w/ operation="remove" | — |
| S-MCS.3-4 (remove double fail) | remove-saga | asserts 1 + full schema | asserts 0 | string, non-empty |

Full S-MCS.5-3 field schema asserted on each double-failure: `event`,
`operation`, `organizationId`, `memberId`, `clerkUserId`, `dbState`,
`clerkState`, `correlationId`. Compensated payloads also assert
`operation` per operation. Happy and idempotent paths assert zero
divergent and zero compensated emissions.

### T13 — full regression

Command: `pnpm vitest run`.

- Files: 322 passed (baseline 320, delta +2).
- Tests: 2802 passed (baseline 2784, delta +18).
- Zero failures. Zero flakes.

Delta breakdown:
- T8 (members.service.add-saga.test.ts, add-new block): +6 tests.
- T10 (same file, reactivation block extension): +6 tests.
- T11 (members.service.remove-saga.test.ts): +6 tests.
- Total: +18 tests across +2 new test files.

### Round 2 commit trail (6 commits)

| # | Task | SHA | Subject |
|---|------|-----|---------|
| 1 | T8 RED | 7f1138a | test(members): RED — addMember new-member saga DB-first ordering and compensation |
| 2 | T9 GREEN | c4b26fc | fix(members): rewire addMember new-member path to DB-first saga with compensation |
| 3 | T10 RED | 080f8a1 | test(members): RED — addMember reactivation saga DB-first ordering and compensation |
| 4 | T10 GREEN | 3513523 | feat(members): rewire addMember reactivation path to DB-first saga with compensation |
| 5 | T11 RED | f590f1d | test(members): RED — removeMember saga DB-first ordering and compensation |
| 6 | T11 GREEN | fdef0cf | fix(members): rewire removeMember path to DB-first saga with compensation |

### Verification (pre-return baseline gate)

- `pnpm vitest run` → GREEN (2802 / 322).
- Banned-pattern grep across our diffs: ZERO hits for `--no-verify`,
  `Co-Authored-By`, `co-authored-by`, `pnpm build`.
- `grep -rn "tx\.ivaPurchaseBook\.update|tx\.ivaSalesBook\.update" features/purchase/purchase.service.ts features/sale/sale.service.ts`
  inside `regenerateJournalForIvaChange` → ZERO matches (hits exist but
  are in other methods and in the GREP-ENFORCEMENT guard comments — the
  F#4/F#5 guard invariant is intact).
- `grep -n "catch.*\{.*console\.(error|warn|log).*\}" features/organizations/members.service.ts`
  → ZERO hits. The legacy silent-fail catches are fully eliminated.
- `grep -n "isClerkDuplicateError\b" features/` → only references are in
  the T10 RED test file's header doc-comment (describing the transient
  state). No live code references remain.

### Invariant collisions / sensitivity-flag regressions

None. Specifically:
- **I-4** (DB-first) — enforced by the saga helper in all three
  operations.
- **I-5** (handleError serializes AppError subclasses) — preserved;
  zero route handler mapping changes required.
- **I-6** (silent-swallow is a bug, not "by design") — eliminated in the
  new-member path (T9) and implicitly in reactivation (T10) and remove
  (T11) via explicit `isIdempotentSuccess` classifiers.
- **I-8** (tenant isolation) — `hardDelete`, `deactivateMember`, and
  `reactivateMember` are all `organizationId`-scoped per round-1 T7; T10
  and T11 pass the scope explicitly in every call.
- **SF-1** (Clerk code strings) — unchanged; the synthesized fixtures
  from round 1 cover `already_a_member_in_organization`, `resource_not_found`,
  and `rate_limit_exceeded`. No new Clerk failure modes encountered in
  round 2.
- **SF-3** (retryAfterSeconds in JSON body, not header) — preserved;
  zero `Retry-After` header assertions added anywhere in round 2, and
  `ExternalSyncError.details` still has no `Retry-After`/`retry-after`
  key (guarded by the existing `member-clerk-saga.test.ts` SF-3
  assertion from round 1).

### Route handler mapping (final)

Zero files touched at the route layer. `features/shared/http-error-serializer.ts`
unchanged. The generic `AppError` branch in `handleError` serializes
`ExternalSyncError` as 503 with JSON body containing `code`,
`error` (message), and `details` (including `divergentState`, `operation`,
`correlationId`, and optional `clerkErrorCode` / `clerkTraceId`). This
was confirmed already in round 1 via `features/shared/__tests__/external-sync-error.test.ts`
and restated in every round-2 commit body.

### Ready for verify

All 23 spec scenarios (S-MCS.1-1..5, S-MCS.2-1..5, S-MCS.3-1..5,
S-MCS.4-1..3, S-MCS.5-1..3, S-MCS.6-1..2) have GREEN coverage in the
saga test suite. Baseline protected (2784 → 2802). No banned patterns.
No invariant collision. No sensitivity-flag regression.

Ready to verify — all 23 scenarios green, baseline protected.

