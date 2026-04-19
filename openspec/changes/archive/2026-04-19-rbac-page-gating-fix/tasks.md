# Tasks: rbac-page-gating-fix

**Change**: `rbac-page-gating-fix`
**Date**: 2026-04-18
**Status**: READY
**Artifact Store**: hybrid (engram + filesystem)
**Prior**: spec #760, design #761
**Strict TDD Mode**: ACTIVE — every page pair is RED (test) → GREEN (impl)

---

## A. Summary Table

| PR# | Name | Tasks | REQs Covered | Rough LOC | Depends On |
|-----|------|-------|--------------|-----------|------------|
| PR1 | Bypass pages — add `requirePermission` gate | T1.1–T1.25 (25 tasks) | REQ-PG.1–7, PG.10–11, PG.13 | ~460 LOC | — |
| PR2 | Upgrade pages — replace `requireRole` with `requirePermission` | T2.1–T2.9 (9 tasks) | REQ-PG.1–7, PG.8–13 | ~170 LOC | **PR1 must land first** |
| **Total** | | **34 tasks** | All 13 REQs | **~630 LOC** | |

**Explicit dependency**: PR2 depends on PR1 landing. Rationale: PR1 establishes the pattern at scale; PR2's semantic risk (behavior change for financial-statements / monthly-close users) is easier to isolate and rollback independently. Mirrors DCSN-006.

---

## B. PR1 — Bypass Pages (12 B pages + 1 regression guard)

### Ordering convention

Tasks are ordered alphabetically by page path for reviewer sanity. Each page gets:
- **RED task** — create failing test (gate not yet present → test asserts `requirePermission` was called, but page doesn't call it → RED)
- **GREEN task** — edit page to add gate → test goes GREEN + imports cleaned up

Both tasks for a given page ship in ONE commit (DCSN-004 atomicity rule).

---

### T1.1 — RED: test for `accounting/contacts/page.tsx`

**Phase**: RED
**REQs**: REQ-PG.11
**Files touched**:
- CREATE `app/(dashboard)/[orgSlug]/accounting/contacts/__tests__/page.test.ts`

**What**: Write failing test. Mock `next/navigation.redirect` and `@/features/shared/permissions.server.requirePermission` via `vi.hoisted`. Assert:
1. When `mockRequirePermission.mockResolvedValue({ orgId: "org-1" })` → page renders → `mockRequirePermission` called with `("contacts", "read", "acme")` → `mockRedirect` NOT called.
2. When `mockRequirePermission.mockRejectedValue(new Error("forbidden"))` → `mockRedirect` called with `"/acme"`.

Mock any service the page imports (contacts service + client component) so the page can be imported without side effects.

**Expected state**: test file exists, `npx vitest run` on this file is RED (page doesn't call `requirePermission` yet).

---

### T1.2 — GREEN: gate `accounting/contacts/page.tsx`

**Phase**: GREEN
**REQs**: REQ-PG.1, REQ-PG.2, REQ-PG.7, REQ-PG.10, REQ-PG.13
**Files touched**:
- MODIFY `app/(dashboard)/[orgSlug]/accounting/contacts/page.tsx`

**What**:
1. Replace the `requireAuth + requireOrgAccess` double try/catch with:
   ```ts
   let orgId: string;
   try {
     const result = await requirePermission("contacts", "read", orgSlug);
     orgId = result.orgId;
   } catch {
     redirect(`/${orgSlug}`);
   }
   ```
2. Add `import { requirePermission } from "@/features/shared/permissions.server"`.
3. Remove `requireAuth` and `requireOrgAccess` import entries if no longer used elsewhere in the file.
4. `orgSlug` sourced from `const { orgSlug } = await params`.

**Expected state**: T1.1 test is GREEN. `tsc --noEmit` clean on this file.

---

### T1.3 — RED: test for `accounting/cxc/page.tsx`

**Phase**: RED
**REQs**: REQ-PG.11
**Files touched**:
- CREATE `app/(dashboard)/[orgSlug]/accounting/cxc/__tests__/page.test.ts`

**What**: Same structure as T1.1. Assert `requirePermission` called with `("sales", "read", "acme")`. Mock cxc service + cxc client component stubs.

**Expected state**: RED — page not yet gated.

---

### T1.4 — GREEN: gate `accounting/cxc/page.tsx`

**Phase**: GREEN
**REQs**: REQ-PG.1, REQ-PG.2, REQ-PG.7, REQ-PG.10, REQ-PG.13
**Files touched**:
- MODIFY `app/(dashboard)/[orgSlug]/accounting/cxc/page.tsx`

**What**: Replace auth chain with `requirePermission("sales", "read", orgSlug)`. Extract `orgId = result.orgId`. Remove orphan imports. Same atomic pattern as T1.2.

**Expected state**: T1.3 GREEN. tsc clean.

---

### T1.5 — RED: test for `accounting/cxp/page.tsx`

**Phase**: RED
**REQs**: REQ-PG.11
**Files touched**:
- CREATE `app/(dashboard)/[orgSlug]/accounting/cxp/__tests__/page.test.ts`

**What**: Assert `requirePermission` called with `("purchases", "read", "acme")`. Mock cxp service + cxp client component stubs.

**Expected state**: RED.

---

### T1.6 — GREEN: gate `accounting/cxp/page.tsx`

**Phase**: GREEN
**REQs**: REQ-PG.1, REQ-PG.2, REQ-PG.7, REQ-PG.10, REQ-PG.13
**Files touched**:
- MODIFY `app/(dashboard)/[orgSlug]/accounting/cxp/page.tsx`

**What**: Replace auth chain with `requirePermission("purchases", "read", orgSlug)`. Extract `orgId`. Remove orphan imports.

**Expected state**: T1.5 GREEN. tsc clean.

---

### T1.7 — RED: test for `accounting/journal/page.tsx`

**Phase**: RED
**REQs**: REQ-PG.11
**Files touched**:
- CREATE `app/(dashboard)/[orgSlug]/accounting/journal/__tests__/page.test.ts`

**What**: Assert `requirePermission` called with `("journal", "read", "acme")`. Mock journal service + journal client component stubs.

**Expected state**: RED.

---

### T1.8 — GREEN: gate `accounting/journal/page.tsx`

**Phase**: GREEN
**REQs**: REQ-PG.1, REQ-PG.2, REQ-PG.7, REQ-PG.10, REQ-PG.13
**Files touched**:
- MODIFY `app/(dashboard)/[orgSlug]/accounting/journal/page.tsx`

**What**: Replace auth chain with `requirePermission("journal", "read", orgSlug)`. Extract `orgId`. Remove orphan imports.

**Expected state**: T1.7 GREEN. tsc clean.

---

### T1.9 — RED: test for `accounting/ledger/page.tsx`

**Phase**: RED
**REQs**: REQ-PG.11
**Files touched**:
- CREATE `app/(dashboard)/[orgSlug]/accounting/ledger/__tests__/page.test.ts`

**What**: Assert `requirePermission` called with `("journal", "read", "acme")`. Mock ledger service + ledger client component stubs.

**Expected state**: RED.

---

### T1.10 — GREEN: gate `accounting/ledger/page.tsx`

**Phase**: GREEN
**REQs**: REQ-PG.1, REQ-PG.2, REQ-PG.7, REQ-PG.10, REQ-PG.13
**Files touched**:
- MODIFY `app/(dashboard)/[orgSlug]/accounting/ledger/page.tsx`

**What**: Replace auth chain with `requirePermission("journal", "read", orgSlug)`. Extract `orgId`. Remove orphan imports.

**Expected state**: T1.9 GREEN. tsc clean.

---

### T1.11 — RED: test for `dispatches/page.tsx`

**Phase**: RED
**REQs**: REQ-PG.11
**Files touched**:
- CREATE `app/(dashboard)/[orgSlug]/dispatches/__tests__/page.test.ts`

**What**: Assert `requirePermission` called with `("sales", "read", "acme")` — note: `dispatches` page uses `sales` resource per REQ-PG.7 and DCSN-001 of `resource-nav-mapping-fix` (archive #756). Mock `@/features/dispatch`, `@/features/sale`, and `@/components/dispatches/dispatch-list` stubs.

**Expected state**: RED.

---

### T1.12 — GREEN: gate `dispatches/page.tsx`

**Phase**: GREEN
**REQs**: REQ-PG.1, REQ-PG.2, REQ-PG.7, REQ-PG.10, REQ-PG.13
**Files touched**:
- MODIFY `app/(dashboard)/[orgSlug]/dispatches/page.tsx`

**What**: Replace auth chain with `requirePermission("sales", "read", orgSlug)`. Extract `orgId`. Remove orphan imports. Resource is `"sales"` (NOT `"dispatches"`) — enforced by test assertion.

**Expected state**: T1.11 GREEN. tsc clean.

---

### T1.13 — RED: test for `informes/page.tsx`

**Phase**: RED
**REQs**: REQ-PG.11
**Files touched**:
- CREATE `app/(dashboard)/[orgSlug]/informes/__tests__/page.test.ts`

**What**: Assert `requirePermission` called with `("reports", "read", "acme")`. Mock reports landing client component stub.

**Expected state**: RED.

---

### T1.14 — GREEN: gate `informes/page.tsx`

**Phase**: GREEN
**REQs**: REQ-PG.1, REQ-PG.2, REQ-PG.7, REQ-PG.10, REQ-PG.13
**Files touched**:
- MODIFY `app/(dashboard)/[orgSlug]/informes/page.tsx`

**What**: Replace auth chain with `requirePermission("reports", "read", orgSlug)`. Extract `orgId`. Remove orphan imports.

**Expected state**: T1.13 GREEN. tsc clean.

---

### T1.15 — RED: test for `informes/impuestos/libro-compras/page.tsx`

**Phase**: RED
**REQs**: REQ-PG.11
**Files touched**:
- CREATE `app/(dashboard)/[orgSlug]/informes/impuestos/libro-compras/__tests__/page.test.ts`

**What**: Assert `requirePermission` called with `("reports", "read", "acme")`. Mock libro-compras service + client component stubs.

**Expected state**: RED.

---

### T1.16 — GREEN: gate `informes/impuestos/libro-compras/page.tsx`

**Phase**: GREEN
**REQs**: REQ-PG.1, REQ-PG.2, REQ-PG.7, REQ-PG.10, REQ-PG.13
**Files touched**:
- MODIFY `app/(dashboard)/[orgSlug]/informes/impuestos/libro-compras/page.tsx`

**What**: Replace auth chain with `requirePermission("reports", "read", orgSlug)`. Extract `orgId`. Remove orphan imports.

**Expected state**: T1.15 GREEN. tsc clean.

---

### T1.17 — RED: test for `informes/impuestos/libro-ventas/page.tsx`

**Phase**: RED
**REQs**: REQ-PG.11
**Files touched**:
- CREATE `app/(dashboard)/[orgSlug]/informes/impuestos/libro-ventas/__tests__/page.test.ts`

**What**: Assert `requirePermission` called with `("reports", "read", "acme")`. Mock libro-ventas service + client component stubs.

**Expected state**: RED.

---

### T1.18 — GREEN: gate `informes/impuestos/libro-ventas/page.tsx`

**Phase**: GREEN
**REQs**: REQ-PG.1, REQ-PG.2, REQ-PG.7, REQ-PG.10, REQ-PG.13
**Files touched**:
- MODIFY `app/(dashboard)/[orgSlug]/informes/impuestos/libro-ventas/page.tsx`

**What**: Replace auth chain with `requirePermission("reports", "read", orgSlug)`. Extract `orgId`. Remove orphan imports.

**Expected state**: T1.17 GREEN. tsc clean.

---

### T1.19 — RED: test for `payments/page.tsx`

**Phase**: RED
**REQs**: REQ-PG.11
**Files touched**:
- CREATE `app/(dashboard)/[orgSlug]/payments/__tests__/page.test.ts`

**What**: Assert `requirePermission` called with `("payments", "read", "acme")`. Mock payments service + payments client component stubs.

**Expected state**: RED.

---

### T1.20 — GREEN: gate `payments/page.tsx`

**Phase**: GREEN
**REQs**: REQ-PG.1, REQ-PG.2, REQ-PG.7, REQ-PG.10, REQ-PG.13
**Files touched**:
- MODIFY `app/(dashboard)/[orgSlug]/payments/page.tsx`

**What**: Replace auth chain with `requirePermission("payments", "read", orgSlug)`. Extract `orgId`. Remove orphan imports.

**Expected state**: T1.19 GREEN. tsc clean.

---

### T1.21 — RED: test for `purchases/page.tsx`

**Phase**: RED
**REQs**: REQ-PG.11
**Files touched**:
- CREATE `app/(dashboard)/[orgSlug]/purchases/__tests__/page.test.ts`

**What**: Assert `requirePermission` called with `("purchases", "read", "acme")`. Mock purchases service + purchases client component stubs.

**Expected state**: RED.

---

### T1.22 — GREEN: gate `purchases/page.tsx`

**Phase**: GREEN
**REQs**: REQ-PG.1, REQ-PG.2, REQ-PG.7, REQ-PG.10, REQ-PG.13
**Files touched**:
- MODIFY `app/(dashboard)/[orgSlug]/purchases/page.tsx`

**What**: Replace auth chain with `requirePermission("purchases", "read", orgSlug)`. Extract `orgId`. Remove orphan imports.

**Expected state**: T1.21 GREEN. tsc clean.

---

### T1.23 — RED: test for `sales/page.tsx`

**Phase**: RED
**REQs**: REQ-PG.11
**Files touched**:
- CREATE `app/(dashboard)/[orgSlug]/sales/__tests__/page.test.ts`

**What**: Assert `requirePermission` called with `("sales", "read", "acme")`. Mock sales service + sales client component stubs.

**Expected state**: RED.

---

### T1.24 — GREEN: gate `sales/page.tsx`

**Phase**: GREEN
**REQs**: REQ-PG.1, REQ-PG.2, REQ-PG.7, REQ-PG.10, REQ-PG.13
**Files touched**:
- MODIFY `app/(dashboard)/[orgSlug]/sales/page.tsx`

**What**: Replace auth chain with `requirePermission("sales", "read", orgSlug)`. Extract `orgId`. Remove orphan imports.

**Expected state**: T1.23 GREEN. tsc clean.

---

### T1.25 — REGRESSION GUARD: PR1 full suite + tsc

**Phase**: GREEN (guard)
**REQs**: REQ-PG.8, REQ-PG.12, REQ-PG.13
**Files touched**: None — read-only validation

**What**:
1. Run `npx vitest run` — all 12 new test files must be GREEN. Zero failing tests.
2. Run `npx tsc --noEmit` — zero type errors. Confirm no orphan `requireAuth`/`requireOrgAccess` imports flagged.
3. Run `grep -r "requireRole(" app/\(dashboard\)` — zero matches in any of the 12 `page.tsx` files modified in PR1.

**Expected state**: All checks pass before opening PR1.

---

## C. PR2 — Upgrade Pages (4 U pages + 1 regression guard)

> **Depends on PR1** — PR2 must be branched from the merged PR1 state (or at minimum, from a local branch that includes PR1 commits). The semantic risk of the `requireRole → requirePermission` migration is isolated here by design (DCSN-006).

### Ordering convention

Suggested order: `monthly-close` first (simpler — `journal:read`, standalone), then the three `financial-statements/**` pages (same resource `reports:read`, share parent semantics).

Each page's RED+GREEN tasks ship in ONE commit per DCSN-004 (gate edit + test creation atomic). The old `requireAuth + requireOrgAccess + requireRole` triple try/catch is ENTIRELY removed — no shims, no partial states.

---

### T2.1 — RED: test for `accounting/monthly-close/page.tsx`

**Phase**: RED
**REQs**: REQ-PG.11
**Files touched**:
- CREATE `app/(dashboard)/[orgSlug]/accounting/monthly-close/__tests__/page.test.ts`

**What**: Write failing test. Assert:
1. `mockRequirePermission.mockResolvedValue({ orgId: "org-1" })` → page renders → `mockRequirePermission` called with `("journal", "read", "acme")` → `mockRedirect` NOT called.
2. `mockRequirePermission.mockRejectedValue(new Error("forbidden"))` → `mockRedirect` called with `"/acme"`.

Mock monthly-close service + monthly-close client component stubs.

**Expected state**: RED — page currently calls `requireRole(["owner","admin"])`, not `requirePermission`.

---

### T2.2 — GREEN: upgrade `accounting/monthly-close/page.tsx`

**Phase**: GREEN
**REQs**: REQ-PG.1, REQ-PG.2, REQ-PG.7–PG.10, REQ-PG.13
**Files touched**:
- MODIFY `app/(dashboard)/[orgSlug]/accounting/monthly-close/page.tsx`

**What**:
1. Remove ENTIRE triple try/catch chain (`requireAuth` → `requireOrgAccess` → `requireRole`).
2. Replace with single:
   ```ts
   let orgId: string;
   try {
     const result = await requirePermission("journal", "read", orgSlug);
     orgId = result.orgId;
   } catch {
     redirect(`/${orgSlug}`);
   }
   ```
3. Remove imports for `requireAuth`, `requireOrgAccess`, `requireRole` from `@/features/shared` / `@/features/shared/middleware`.
4. Add `import { requirePermission } from "@/features/shared/permissions.server"`.
5. All old redirect targets (`/sign-in`, `/select-org`) removed.

**Expected state**: T2.1 GREEN. No `requireRole` import remains. tsc clean.

---

### T2.3 — RED: test for `accounting/financial-statements/page.tsx`

**Phase**: RED
**REQs**: REQ-PG.11
**Files touched**:
- CREATE `app/(dashboard)/[orgSlug]/accounting/financial-statements/__tests__/page.test.ts`

**What**: Assert `requirePermission` called with `("reports", "read", "acme")`. Mock `FinancialStatementsLanding` client component stub.

**Expected state**: RED — page currently calls `requireRole(["owner","admin","contador"])`.

---

### T2.4 — GREEN: upgrade `accounting/financial-statements/page.tsx`

**Phase**: GREEN
**REQs**: REQ-PG.1, REQ-PG.2, REQ-PG.7–PG.10, REQ-PG.13
**Files touched**:
- MODIFY `app/(dashboard)/[orgSlug]/accounting/financial-statements/page.tsx`

**What**: Remove triple try/catch, replace with `requirePermission("reports", "read", orgSlug)`. Extract `orgId = result.orgId`. Remove all old auth imports. This unblocks custom roles with `reports:read` from accessing the page (Scenario B in spec §4).

**Expected state**: T2.3 GREEN. No `requireRole`/`requireAuth`/`requireOrgAccess` imports remain. tsc clean.

---

### T2.5 — RED: test for `accounting/financial-statements/balance-sheet/page.tsx`

**Phase**: RED
**REQs**: REQ-PG.11
**Files touched**:
- CREATE `app/(dashboard)/[orgSlug]/accounting/financial-statements/balance-sheet/__tests__/page.test.ts`

**What**: Assert `requirePermission` called with `("reports", "read", "acme")`. Mock balance-sheet service + balance-sheet client component stubs.

**Expected state**: RED — page currently calls `requireRole(["owner","admin","contador"])`.

---

### T2.6 — GREEN: upgrade `accounting/financial-statements/balance-sheet/page.tsx`

**Phase**: GREEN
**REQs**: REQ-PG.1, REQ-PG.2, REQ-PG.7–PG.10, REQ-PG.13
**Files touched**:
- MODIFY `app/(dashboard)/[orgSlug]/accounting/financial-statements/balance-sheet/page.tsx`

**What**: Same migration as T2.4. Replace triple chain with `requirePermission("reports", "read", orgSlug)`. Remove old imports atomically.

**Expected state**: T2.5 GREEN. No old auth imports. tsc clean.

---

### T2.7 — RED: test for `accounting/financial-statements/income-statement/page.tsx`

**Phase**: RED
**REQs**: REQ-PG.11
**Files touched**:
- CREATE `app/(dashboard)/[orgSlug]/accounting/financial-statements/income-statement/__tests__/page.test.ts`

**What**: Assert `requirePermission` called with `("reports", "read", "acme")`. Mock income-statement service + income-statement client component stubs.

**Expected state**: RED — page currently calls `requireRole(["owner","admin","contador"])`.

---

### T2.8 — GREEN: upgrade `accounting/financial-statements/income-statement/page.tsx`

**Phase**: GREEN
**REQs**: REQ-PG.1, REQ-PG.2, REQ-PG.7–PG.10, REQ-PG.13
**Files touched**:
- MODIFY `app/(dashboard)/[orgSlug]/accounting/financial-statements/income-statement/page.tsx`

**What**: Same migration as T2.4 and T2.6. Replace triple chain with `requirePermission("reports", "read", orgSlug)`. Remove old imports atomically.

**Expected state**: T2.7 GREEN. No old auth imports. tsc clean.

---

### T2.9 — REGRESSION GUARD: PR2 full suite + tsc + grep

**Phase**: GREEN (guard)
**REQs**: REQ-PG.8, REQ-PG.12, REQ-PG.13
**Files touched**: None — read-only validation

**What**:
1. Run `npx vitest run` — all 16 test files (12 from PR1 + 4 new from PR2) must be GREEN.
2. Run `npx tsc --noEmit` — zero type errors across all 16 modified pages.
3. Run `grep -r "requireRole(" app/\(dashboard\)` — zero matches in any `page.tsx` file. This is the REQ-PG.8 acceptance gate.
4. Confirm `grep -r "requireAuth\|requireOrgAccess" app/\(dashboard\)/\[orgSlug\]` returns zero matches inside the 16 affected `page.tsx` files (REQ-PG.13).

**Expected state**: All checks pass. Change is ready for `sdd-verify`.

---

## D. Test Pattern Reference

All 16 test files follow this structure (established in `settings/roles/__tests__/page.test.ts` — the canonical reference):

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRedirect, mockRequirePermission } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));
vi.mock("@/features/shared/permissions.server", () => ({
  requirePermission: mockRequirePermission,
}));

// Additional page-specific mocks go here (service + client component)

import PageComponent from "../page";

const ORG_SLUG = "acme";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG });
}

beforeEach(() => {
  vi.clearAllMocks();
  // reset service mock to safe default if needed
});

describe("/<page-path> — rbac gate", () => {
  it("renders when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });
    await PageComponent({ params: makeParams() });
    expect(mockRequirePermission).toHaveBeenCalledWith("<resource>", "read", ORG_SLUG);
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));
    await PageComponent({ params: makeParams() });
    expect(mockRedirect).toHaveBeenCalledWith(`/${ORG_SLUG}`);
  });
});
```

**Key rules**:
- File name: `page.test.ts` (NOT `.test.tsx`) — server component, node env.
- `vi.hoisted` is mandatory — mock functions must be defined before module evaluation.
- `vi.clearAllMocks()` in `beforeEach` to reset call counts between tests.
- No assertions on rendered output — gate correctness only.

---

## E. Implementation Page Pattern Reference

All 16 page edits follow this canonical pattern (DCSN-001, DCSN-002, DCSN-003):

```typescript
// BEFORE (bypass pages — double try/catch)
let userId: string;
try {
  const session = await requireAuth();
  userId = session.userId;
} catch {
  redirect("/sign-in");
}
let orgId: string;
try {
  orgId = await requireOrgAccess(userId, orgSlug);
} catch {
  redirect("/select-org");
}
// ... page data fetch ...

// AFTER (all 16 pages — single try/catch)
let orgId: string;
try {
  const result = await requirePermission("<resource>", "read", orgSlug);
  orgId = result.orgId;
} catch {
  redirect(`/${orgSlug}`);
}
// ... page data fetch using orgId ...
```

For U pages (PR2), the BEFORE state has a third `requireRole` try/catch block — remove all three atomically.

---

## F. REQ Coverage Matrix

| REQ | PR1 tasks | PR2 tasks |
|-----|-----------|-----------|
| REQ-PG.1 — gate invocation before data fetch | T1.2,4,6,8,10,12,14,16,18,20,22,24 | T2.2,4,6,8 |
| REQ-PG.2 — redirect to `/${orgSlug}` on failure | T1.2,4,6,8,10,12,14,16,18,20,22,24 | T2.2,4,6,8 |
| REQ-PG.3 — auth failure cascade (via requirePermission) | Covered by pattern, verified by T1.* RED/GREEN | T2.* RED/GREEN |
| REQ-PG.4 — org access failure cascade | Covered by pattern | Covered by pattern |
| REQ-PG.5 — authorized role renders page | T1.1,3,5,7,9,11,13,15,17,19,21,23 (authorized assertion) | T2.1,3,5,7 |
| REQ-PG.6 — unauthorized role redirects | T1.1,3,5,7,9,11,13,15,17,19,21,23 (forbidden assertion) | T2.1,3,5,7 |
| REQ-PG.7 — resource:action mapping | Asserted in every RED test `toHaveBeenCalledWith(resource, "read", slug)` | Same |
| REQ-PG.8 — no `requireRole` in page.tsx | T1.25 (grep guard) | T2.9 (grep guard) |
| REQ-PG.9 — requireRole migration (4 U pages) | — | T2.2,4,6,8 |
| REQ-PG.10 — orgId from result.orgId | T1.2,4,6,8,10,12,14,16,18,20,22,24 | T2.2,4,6,8 |
| REQ-PG.11 — test coverage per page | T1.1,3,5,7,9,11,13,15,17,19,21,23 | T2.1,3,5,7 |
| REQ-PG.12 — tsc clean | T1.25 + individual GREEN tasks | T2.9 + individual GREEN tasks |
| REQ-PG.13 — atomic removal of old pattern | T1.2,4,6,8,10,12,14,16,18,20,22,24 | T2.2,4,6,8 + T2.9 (grep orphan guard) |

---

## Return Envelope

- **status**: COMPLETE
- **executive_summary**: 34 tasks split across 2 PRs. PR1 covers 12 bypass pages (24 RED/GREEN tasks + 1 regression guard, ~460 LOC). PR2 covers 4 requireRole upgrade pages (8 RED/GREEN tasks + 1 regression guard, ~170 LOC, depends on PR1). Every task pair strictly follows RED (test) → GREEN (impl). Regression guards in T1.25 and T2.9 map REQ-PG.8 (grep for requireRole), REQ-PG.12 (tsc --noEmit), and REQ-PG.13 (orphan import check). Total ~630 LOC.
- **artifacts**: `openspec/changes/rbac-page-gating-fix/tasks.md` + engram topic `sdd/rbac-page-gating-fix/tasks`
- **next_recommended**: `sdd-apply PR1` (T1.1–T1.25, 12 bypass pages)
- **risks**:
  - Each page's service/client mocks in RED tests must be resolved by reading the actual page imports during apply — baseline mocks are fixed (DCSN-005), extra mocks depend on page content
  - PR2 must not be opened until PR1 is merged — branching strategy must enforce this
- **skill_resolution**: injected
