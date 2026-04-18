# Verification Report: accounting-rbac

**Change**: `accounting-rbac`
**Spec Version**: 3 capabilities, 11 REQs, 22 scenarios
**Mode**: Strict TDD
**Date**: 2026-04-17
**Verifier**: sdd-verify sub-agent

---

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 27 |
| Tasks complete | 27 |
| Tasks incomplete | 0 |

All 27 tasks across PR1–PR7 are marked `[x]`. No incomplete tasks.

---

## Build & Tests Execution

**Build**: ✅ Passed

```
pnpm tsc --noEmit
EXIT: 0
```

**Tests**: ✅ 1254 passed / ❌ 0 failed / ⚠️ 0 skipped

```
RUN  v4.1.4
Test Files  124 passed (124)
Tests  1254 passed (1254)
Duration  21.05s
```

**Gap closure pass (post-initial-verify)**: 5 targeted tests added to close the 3 UNTESTED + 2 PARTIAL scenarios from the initial report. Suite delta: +9 (+5 new + 4 from incremental fixes). All green.

**Coverage**: Overall project 54.33% statements / 44.16% branches — No project-wide threshold configured. Changed-file breakdown below.

---

## TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | Found in apply-progress (7 PRs, RED→GREEN→REFACTOR documented) |
| All tasks have tests | ✅ | 13 RED tasks each have matching test files confirmed on disk |
| RED confirmed (tests exist) | ✅ | 7/7 key test files verified: permissions.test.ts, require-permission.test.ts, sale-canpost.test.ts, members.service.test.ts, gated.test.tsx, add-member-dialog.test.tsx, journal-entry-detail-rbac.test.tsx + 5 UI-rbac files |
| GREEN confirmed (tests pass) | ✅ | 1245/1245 tests pass on execution |
| Triangulation adequate | ✅ | Matrix: 144+18 table-driven cases; canPost: 8 service cases × 3 services; Gated: 12 cases with varying role/state; members: 9 cases |
| Safety Net for modified files | ✅ | apply-progress reports safety net run; baseline was 1005 tests before change |

**TDD Compliance**: 6/6 checks passed

---

## Test Layer Distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | ~197 | 9 | vitest (node project) |
| Integration | ~48 | 7 | vitest + @testing-library/react (jsdom project) |
| E2E | 0 | 0 | Not installed — deferred to QA pass |
| **Total (RBAC-related)** | **~245** | **16** | |

Note: Approximate counts because some test files cover multiple concerns. Overall suite: 1245 tests / 124 files.

Distribution classification:
- **Unit** (`|node|`): permissions.test.ts (162), require-permission.test.ts (8), sale-canpost.test.ts (8), members.service.test.ts (19)
- **Integration** (`|components|`): gated.test.tsx (12), add-member-dialog.test.tsx (2), journal-entry-detail-rbac.test.tsx (5), sale-form-rbac.test.tsx (4), purchase-form-rbac.test.tsx (4), payment-form-rbac.test.tsx (4), dispatch-form-rbac.test.tsx (4), voucher-types-manager-rbac.test.tsx (4)

---

## Changed File Coverage

| File | Line % | Branch % | Uncovered Lines | Rating |
|------|--------|----------|-----------------|--------|
| `features/shared/permissions.ts` | 66.66% | 25% | L85–94 (getRagScopes, getUploadScopes, canUploadToScope — pre-existing functions, NOT introduced by this change; canAccess/canPost fully covered) | ⚠️ Acceptable |
| `features/shared/permissions.server.ts` | Not reported separately | — | Tested via require-permission.test.ts (8 cases, all pass) | ✅ |
| `features/organizations/members.validation.ts` | Not reported separately | — | Tested via members.service.test.ts (7 cases covering all 5 assignable roles + owner rejection + invalid role) | ✅ |
| `features/organizations/members.service.ts` | ~17.64% | ~16.66% | updateRole/removeMember self-guard covered (4 cases). Remaining service methods have pre-existing low coverage. | ⚠️ Acceptable for changed paths |
| `components/common/gated.tsx` | Not reported separately | — | Tested via gated.test.tsx (12 cases; all 3 scenarios fully covered) | ✅ |
| `features/sale/sale.service.ts` | 69.18% | 55% | canPost guard fully covered (3 service cases). Remaining uncovered lines are pre-existing. | ⚠️ Acceptable for changed paths |

**Note**: Coverage tool groups by directory — some changed files not reported at individual level. All RBAC-critical paths (canAccess, canPost, requirePermission, Gated, assignableRoles, self-role guard) are confirmed tested by dedicated test files.

---

## Assertion Quality

### Potential Issues Found

| File | Line | Assertion | Issue | Severity |
|------|------|-----------|-------|----------|
| `features/shared/__tests__/permissions.test.ts` | 101 | `expect(PERMISSIONS_READ[r]).toBeDefined()` | Type-only assertion in `for` loop — no companion value assertion within same test | WARNING |
| `features/shared/__tests__/permissions.test.ts` | 107 | `expect(PERMISSIONS_WRITE[r]).toBeDefined()` | Same as above — type-only in loop | WARNING |
| `features/shared/__tests__/require-permission.test.ts` | 68 | `expect(call).toBeDefined()` | Guard check before destructuring — acceptable as pre-condition, not standalone | OK (paired with value assertions at L70–76) |

**Mitigating context**: The two WARNING assertions in permissions.test.ts appear in "structural catalog" tests (REQ-P.1). They are immediately followed by the 144-case `canAccess` table-driven suite (REQ-P.2) which asserts actual Boolean values. The `toBeDefined()` tests are catalog existence checks, not behavioral proofs. They are genuinely type-only but serve a structural purpose and are supplemented by behavioral tests in the next describe block.

**Mock/assertion ratio**: permissions.test.ts — 0 mocks / 14 expect calls (excellent). require-permission.test.ts — 3 vi.mock / 18 expect calls (0.17 ratio — well below 2× threshold). sale-canpost.test.ts — 0 mocks / 8 expect calls. members.service.test.ts — 3 vi.fn / 17 expect calls. gated.test.tsx — 1 vi.mock / 12 expect calls.

**Assertion quality**: 0 CRITICAL, 2 WARNING (type-only assertions supplemented by companion behavioral tests — no action required)

---

## Spec Compliance Matrix

### Capability: rbac-roles

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| REQ-R.1 Role Set | R.1-S1 — cobrador/auxiliar accepted via members API | `members.service.test.ts > S-R1-S1 accepts cobrador`, `S-R1-S1 accepts auxiliar` | ✅ COMPLIANT |
| REQ-R.1 Role Set | R.1-S2 — owner not assignable via API | `members.service.test.ts > S-R1-S2 rejects role=owner` | ✅ COMPLIANT |
| REQ-R.1 Role Set | R.1-S3 — invalid role rejected (422) | `members.service.test.ts > R.1-S3 rejects role=super-admin` | ✅ COMPLIANT |
| REQ-R.2 Per-Org Scope | R.2-S1 — same user, different orgs → different roles | `members.service.test.ts > MembersService — per-org scope (REQ-R.2)` | ✅ COMPLIANT |
| REQ-R.2 Per-Org Scope | R.2-S2 — duplicate member rejected (409) | `members.service.test.ts > MembersService.addMember — duplicate detection (REQ-R.2-S2)` | ✅ COMPLIANT |
| REQ-R.3 Role Mutability | R.3-S1 — admin modifies another member's role → 200 | `members.service.test.ts > MembersService.updateRole — admin modifies another member (REQ-R.3-S1)` | ✅ COMPLIANT |
| REQ-R.3 Role Mutability | R.3-S2 — self-role-change rejected → 403 | `members.service.test.ts > S-R3-S2 throws ForbiddenError`, `S-R3-S2 error carries CANNOT_CHANGE_OWN_ROLE` | ✅ COMPLIANT |

### Capability: rbac-permissions-matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| REQ-P.1 Resource Catalog | P.1-S1 — exactly 12 resources, no `accounting` | `permissions.test.ts > exposes exactly 12 resources`, `does not include deprecated accounting` | ✅ COMPLIANT |
| REQ-P.2 Authorization Matrix | P.2-S1 — contador reads reports → true | `permissions.test.ts > P.2-S1 — contador reads reports` | ✅ COMPLIANT |
| REQ-P.2 Authorization Matrix | P.2-S2 — cobrador cannot touch journal | `permissions.test.ts > P.2-S2 — cobrador cannot touch journal (read or write)` | ✅ COMPLIANT |
| REQ-P.2 Authorization Matrix | P.2-S3 — auxiliar writes dispatches → true | `permissions.test.ts > P.2-S3 — auxiliar writes dispatches` | ✅ COMPLIANT |
| REQ-P.2 Authorization Matrix | Full matrix 144 cases | `permissions.test.ts > REQ-P.2 — canAccess matrix (144 cases)` — all 144 table-driven cases pass | ✅ COMPLIANT |
| REQ-P.3 Server-Side Enforcement | P.3-S1 — cobrador POST journal → 403 | `require-permission.test.ts > S-P3-S1 throws ForbiddenError`, `sale-canpost.test.ts > JournalService cobrador → ForbiddenError` | ✅ COMPLIANT |
| REQ-P.3 Server-Side Enforcement | P.3-S2 — contador POST sale → 201 | `require-permission.test.ts > S-P3-S2 returns role (read)`, `S-P3-S2-write — contador → sales/write → pass` | ✅ COMPLIANT |
| REQ-P.3 Server-Side Enforcement | P.3-S3 — auxiliar POST sale draft OK, POST post → 403 | `require-permission.test.ts > S-P3-S3 returns role=auxiliar`, `permissions.test.ts > P.3-S3 auxiliar cannot post sales`, `sale-canpost.test.ts > auxiliar → ForbiddenError(POST_NOT_ALLOWED_FOR_ROLE)` | ✅ COMPLIANT |
| REQ-P.4 No Legacy requireRole | P.4-S1 — grep returns zero matches | `grep requireRole( app/api/organizations/ --include=route.ts` → 0 | ✅ COMPLIANT |

### Capability: rbac-ui-gating

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| REQ-U.1 Gated Component | U.1-S1 — contador sees Contabilizar | `gated.test.tsx > U.1-S1 renders children when canAccess(contador, journal, write) is true` | ✅ COMPLIANT |
| REQ-U.1 Gated Component | U.1-S2 — cobrador no ve Editar en sale detail | `gated.test.tsx > U.1-S2 does NOT render children when canAccess(cobrador, sales, write) is false` | ✅ COMPLIANT |
| REQ-U.1 Gated Component | U.1-S3 — loading state renders nothing | `gated.test.tsx > U.1-S3 renders nothing while isLoading=true` | ✅ COMPLIANT |
| REQ-U.2 useCanAccess Hook | U.2-S1 — hook returns bool | `gated.test.tsx > U.2-S1 returns true for auxiliar + sales/write`, `returns false for cobrador + journal/write` | ✅ COMPLIANT |
| REQ-U.2 useCanAccess Hook | U.2-S2 — hook during loading → false | `gated.test.tsx > U.2-S2 returns false while isLoading=true` | ✅ COMPLIANT |
| REQ-U.3 Action Buttons Gated | U.3-S1 — cobrador on JE detail: no Editar/Contabilizar/Anular | `journal-entry-detail-rbac.test.tsx > T6.1-je-1 cobrador: Editar/Contabilizar OCULTOS` | ✅ COMPLIANT |
| REQ-U.3 Action Buttons Gated | U.3-S2 — auxiliar on sale detail: Editar hidden; status-gate orthogonal to role-gate | `sale-form-rbac.test.tsx > T6.1-sa-1/T6.1-sa-3 (RBAC dim)`, `sale-form-rbac.test.tsx > SaleForm — status-gate orthogonal to role-gate (REQ-U.3-S2)` | ✅ COMPLIANT |
| REQ-U.4 Members Role Picker | U.4-S1 — picker has exactly 5 roles, no owner | `add-member-dialog.test.tsx > T6.3-1 muestra exactamente los 5 roles asignables`, `T6.3-2 NO ofrece Propietario` | ✅ COMPLIANT |

**Compliance summary**: **22/22 scenarios compliant (✅)** after gap-closure pass — 0 untested, 0 partial.

---

## Correctness (Static — Structural Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Role type: 6 literals (owner, admin, contador, cobrador, auxiliar, member) | ✅ Implemented | `features/shared/permissions.ts` L1–7 |
| Resource type: 12 literals, no `accounting` | ✅ Implemented | `features/shared/permissions.ts` L9–21 |
| Action type: read\|write | ✅ Implemented | `features/shared/permissions.ts` L23 |
| PERMISSIONS_READ / PERMISSIONS_WRITE maps | ✅ Implemented | L27–55, exactly matches spec matrix |
| POST_ALLOWED_ROLES: owner, admin, contador only for sales/purchases/journal | ✅ Implemented | L59–63, auxiliar excluded confirmed |
| requirePermission(resource, action, orgSlug) → {session, orgId, role} | ✅ Implemented | `features/shared/permissions.server.ts` L13–24 |
| assignableRoles Zod enum: 5 roles, owner excluded | ✅ Implemented | `features/organizations/members.validation.ts` L3–9 |
| MembersService.updateRole self-guard → ForbiddenError(CANNOT_CHANGE_OWN_ROLE) | ✅ Implemented | Confirmed via test execution |
| MembersService.removeMember self-guard → same ForbiddenError (PR7 7.4) | ✅ Implemented | Confirmed via test execution |
| canPost guard in SaleService, PurchaseService, JournalService | ✅ Implemented | Confirmed via sale-canpost.test.ts execution |
| `<Gated resource action>` component | ✅ Implemented | `components/common/gated.tsx` |
| useCanAccess hook | ✅ Implemented | `components/common/gated.tsx` L15–19 |
| requireRole( in route handlers = 0 | ✅ Implemented | `grep -rn requireRole( app/api/organizations/ --include=route.ts` → 0 |
| UI sweep: JE detail, sale/purchase detail, payment/dispatch forms, voucher-types-manager | ✅ Implemented | Confirmed via 6 RBAC integration test files all passing |
| Members role picker: 5 options | ✅ Implemented | `add-member-dialog.test.tsx` passing |

---

## Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| D.1 — Two maps PERMISSIONS_READ / PERMISSIONS_WRITE | ✅ Yes | Exact structure in permissions.ts |
| D.1 — POST_ALLOWED_ROLES separate map | ✅ Yes | Exported at L59–63 |
| D.2 — requirePermission(resource, action, orgSlug) 3-arg signature | ✅ Yes | Matches design interface exactly |
| D.2 — ~74 route sweep completed, 0 requireRole( remaining | ✅ Yes | Verified by grep: 0 matches |
| D.3 — W-draft enforcement at service layer via canPost | ✅ Yes | canPost called in SaleService/PurchaseService/JournalService; NOT in requirePermission (per design) |
| D.4 — Self-role-change → ForbiddenError(CANNOT_CHANGE_OWN_ROLE) at service | ✅ Yes | Both updateRole and removeMember |
| D.5 — Owner no-op, not in assignableRoles | ✅ Yes | assignableRoles has 5 entries; owner absent |
| File changes match design table | ✅ Yes | All 13 major file change categories in design were implemented |

---

## Issues Found

**CRITICAL** (must fix before archive):
- None

**WARNING** (should fix):
1. ~~REQ-R.2 UNTESTED~~ — **CLOSED** in gap-closure pass. `members.service.test.ts > per-org scope` + `addMember duplicate detection`.
2. ~~REQ-R.3-S1 UNTESTED~~ — **CLOSED**. `members.service.test.ts > updateRole admin modifies another member`.
3. ~~REQ-P.3-S2 PARTIAL~~ — **CLOSED**. `require-permission.test.ts > S-P3-S2-write — contador → sales/write → pass`.
4. ~~REQ-U.3-S2 PARTIAL~~ — **CLOSED**. `sale-form-rbac.test.tsx > status-gate orthogonal to role-gate`.
5. **Assertion quality: 2 type-only `toBeDefined()` assertions** in permissions.test.ts lines 101/107 inside loops. These are supplemented by 144-case behavioral tests but the loop assertions themselves prove nothing about correctness — only existence. Low severity; not closed.

**SUGGESTION** (nice to have):
1. E2E tests deferred to QA pass — for cobrador payment OK + journal 403, auxiliar draft sale OK + POST sale 403. These are covered at unit/integration level but live browser validation would close the coverage gap.
2. R.3-S1 happy path test would also increase `members.service.ts` line coverage (currently 17.64% — the `updateMemberRole` repo call branch is untested).
3. Consider adding `canAccess` for the `owner` role to R.2 per-org test to verify cross-org isolation explicitly.

---

## Verdict

**PASS**

1254/1254 tests pass, `tsc --noEmit` clean, zero `requireRole(` in migrated routes, all design decisions D.1–D.5 followed. **22/22 spec scenarios have passing tests proving behavior** after the gap-closure pass. Only remaining WARNING is a low-severity assertion-quality note (2 `toBeDefined()` loops in permissions.test.ts, supplemented by the 144-case behavioral suite). Ready for archive.
