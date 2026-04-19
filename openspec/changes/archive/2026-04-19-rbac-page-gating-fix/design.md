# Design: rbac-page-gating-fix

**Change**: `rbac-page-gating-fix`
**Date**: 2026-04-18
**Status**: APPROVED
**Artifact Store**: hybrid (engram + filesystem)
**Prior**: proposal (engram #759), spec (engram #760), explore #758

---

## A. Context

Sixteen dashboard `page.tsx` files under `app/(dashboard)/[orgSlug]/` bypass the dynamic RBAC matrix introduced by `custom-roles` (archive #715) and reinforced by `resource-nav-mapping-fix` (archive #756).

Two flavors of the bug:

1. **Bypass (12 pages)**: the page gates only `requireAuth + requireOrgAccess` — any authenticated member of the org can load it via direct URL. Nav visibility is not a security boundary.
2. **Wrong gate (4 pages)**: `financial-statements/**` (3 pages) and `accounting/monthly-close/page.tsx` call `requireRole(userId, orgId, ["owner", "admin", "contador"])`. Hardcoded slugs bypass the custom-roles matrix — a custom role with `reports:read` cannot access `financial-statements`, and a custom role with `journal:read` cannot access `monthly-close`. This is worse than a bypass because it contradicts the matrix.

Canonical convention exists and is battle-tested in 7 `settings/**/page.tsx` files and `members/page.tsx`:

```ts
let orgId: string;
try {
  const result = await requirePermission("resource", "read", orgSlug);
  orgId = result.orgId;
} catch {
  redirect(`/${orgSlug}`);
}
```

`requirePermission(resource, action, orgSlug)` (see `features/shared/permissions.server.ts:20`) cascades `requireAuth → requireOrgAccess → matrix check → requireRole(allowedRoles)` and returns `{ session, orgId, role }`. The spec freezes the pattern in REQ-PG.1, REQ-PG.2, REQ-PG.10.

The design fixes those 16 pages with the same pattern. No wrapper util, no proxy.ts, no new infrastructure. The `Resource` union and system roles remain frozen (DCSN-001 from `resource-nav-mapping-fix`).

---

## B. Decisions

### DCSN-001 — Page-by-page `requirePermission`, no HOF, no proxy.ts

**Decision**: Edit each of the 16 `page.tsx` files to call `requirePermission` directly inline, following the canonical convention.

**Rationale**:
- The convention already exists in 8 pages (`settings/**`, `members/page.tsx`) and is readable at a glance.
- Zero new abstractions, zero cognitive cost. Every page is self-contained — the gate is visible next to the render logic.
- One line of `grep` (`grep -r "requireRole(" app/(dashboard)`) is the regression guard (REQ-PG.8).

**Rejected — Approach B (wrapper util `lib/with-permission.ts`)**:
A HOF that wraps the page component to inject `requirePermission` would mean 1 less try/catch per page. But React Server Components + the params-as-Promise pattern (Next.js 16) do not compose cleanly with HOFs returning async functions — the wrapper must re-unwrap `params`, lose type inference on `searchParams`, and recreate the very try/catch we are trying to remove. Net LOC delta is negative after typing; readability is worse. Also: introducing a new util to cover 16 callsites while leaving 8 canonical callsites untouched creates two conventions. Two conventions = zero conventions.

**Rejected — Approach C (proxy.ts gating)**:
Next.js 16 renames `middleware.ts` → `proxy.ts` (documented in `node_modules/next/dist/docs/`). We already use `proxy.ts` for Clerk auth. Adding an RBAC matrix read per request at the proxy layer means: (a) a DB roundtrip on every edge invocation, (b) no access to the resolved `orgSlug → orgId` (proxy runs before server component params resolve), and (c) Server Functions (actions) do not pass through proxy — creating a gap where page-layer gating protects the page but server actions remain wide open. Confirmed by explore #758; incompatible with the custom-roles matrix that already lives at the service layer.

---

### DCSN-002 — Single try/catch with `let orgId: string`, no non-null assertions

**Decision**: One try/catch. Declare `let orgId: string` (definite assignment) and assign `orgId = result.orgId` inside the try. On catch, call `redirect(...)` — which has the `never` return type and satisfies TypeScript's definite-assignment analysis.

```ts
let orgId: string;
try {
  const result = await requirePermission("sales", "read", orgSlug);
  orgId = result.orgId;
} catch {
  redirect(`/${orgSlug}`);
}
// orgId is definitely assigned here — redirect() returns never
```

**Rationale**:
- Matches `members/page.tsx` and `settings/roles/page.tsx` verbatim.
- `redirect` from `next/navigation` is typed `never`, so TypeScript recognizes the catch branch as terminating. No `!`, no `as string`, no `?? throw`.
- Single try/catch collapses the 3-tier cascade (`requireAuth` / `requireOrgAccess` / `requireRole`) into one because `requirePermission` already internalizes all three. Removing the old double try/catch is the whole point of the migration.

**Rejected — nested double try/catch** (the existing pattern in `financial-statements/page.tsx`):
Three `try { ... } catch { redirect(...) }` blocks, three different redirect targets (`/sign-in`, `/select-org`, `/${orgSlug}`). Inherited from a pre-matrix era. It's verbose, and the first two redirects are wrong once `requirePermission` is the contract — Clerk middleware handles the auth bounce, and org-access failure should dead-end in the org root, not in a picker the user may not need.

**Rejected — non-null assertions** (`const orgId = result!.orgId`):
Strict TypeScript forbids unjustified `!`. The `let ... : string` pattern is the project standard and makes definite assignment a compile-time guarantee rather than a runtime gamble.

**Rejected — optional `string | undefined`** (`let orgId: string | undefined`):
Forces every downstream call to re-narrow `orgId`. It's the exact anti-pattern that births non-null assertions. Keep the type definite from the first line.

---

### DCSN-003 — Redirect target `/${orgSlug}` on permission failure

**Decision**: All permission failures redirect to `/${orgSlug}` (the org root dashboard). The catch block never redirects to `/sign-in` or `/select-org`.

**Rationale**:
- Clerk middleware in `proxy.ts` handles the unauthenticated cascade — by the time a page renders, the user IS authenticated. If they hit permission failure, they are authenticated AND in the org, just lacking the matrix entry. Sending them to `/sign-in` is wrong (they're signed in) and to `/select-org` is wrong (they've already selected one).
- The org root `/${orgSlug}` is the neutral fallback: the user lands on their dashboard home and sees only the nav items they have access to (the existing sidebar-granular-gating matrix). Zero dead ends, zero confusion.
- This matches the 8 canonical pages verbatim.

**Rejected — `/sign-in`**: sends authenticated users to a login page. Creates a confusing loop because Clerk will bounce them back.

**Rejected — `/select-org`**: the user is already in `/${orgSlug}` — the slug is resolved. Sending them to a picker is UX garbage.

**Rejected — 403 error page**: no such page exists; creating one is out of scope and contradicts the proposal's "no new infrastructure" rule.

---

### DCSN-004 — Atomic gate + test migration for `requireRole` pages

**Decision**: The 4 `requireRole` pages (`financial-statements/**` × 3, `accounting/monthly-close`) migrate in the SAME commit that rewrites their tests. No parallel shim, no feature flag, no two-step migration.

**Rationale**:
- `requireRole` is imported from `@/features/shared/middleware`. If we replace the page gate with `requirePermission` but leave tests mocking `requireRole`, the tests pass vacuously because `requireRole` is no longer called by the page. Worse: if any test setup expects `requireRole` to throw, the test silently changes semantics.
- **Good news from discovery**: grep confirmed zero tests currently mock `requireRole` for these 4 pages (the 2 existing `__tests__/page.test.ts` are for `settings/roles` and `accounting/journal/[entryId]/edit`, neither of which uses `requireRole`). The "mock cascade" risk in the proposal turned out to be a non-risk — but the invariant stands: for each of the 4 `U` pages, gate edit and test creation ship in ONE commit so they never drift.
- Atomicity also satisfies REQ-PG.13 (no orphan imports) — the same commit deletes the unused `requireRole` import, which is what `tsc --noEmit` flags.

**Rejected — parallel shim** (keep `requireRole` call, add `requirePermission` next to it, then remove `requireRole` later):
Doubles the gate calls, adds ambiguity about which one "wins" on failure, and ships a broken intermediate state. Strict TDD Mode + conventional commits reject partial states.

**Rejected — two-step (gate edit now, test later)**:
Violates project standard `tsc --noEmit` clean. The `requireRole` import becomes orphan at commit time.

---

### DCSN-005 — Test pattern: `vi.hoisted` + 2 mocks + 2 baseline assertions per page

**Decision**: Every one of the 16 pages gets a `__tests__/page.test.ts` file using the exact pattern established in `settings/roles/__tests__/page.test.ts`:

```ts
const { mockRedirect, mockRequirePermission } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));
vi.mock("@/features/shared/permissions.server", () => ({
  requirePermission: mockRequirePermission,
}));
```

Plus any service or client-component mocks the page needs to render (e.g., `vi.mock("@/features/dispatch", ...)` for the `dispatches` page, `vi.mock("@/components/dispatches/dispatch-list", ...)` to stub the client component).

**Two baseline assertions per page** (matches REQ-PG.11):
1. **Authorized renders**: `mockRequirePermission.mockResolvedValue({ orgId: "org-1" })` → call the page → assert `mockRedirect` NOT called AND `mockRequirePermission` called with the EXACT expected `(resource, action, orgSlug)` triple.
2. **Forbidden redirects**: `mockRequirePermission.mockRejectedValue(new Error("forbidden"))` → call the page → assert `mockRedirect` called with `/${orgSlug}`.

**Rationale**:
- The pattern is proven — `settings/roles/__tests__/page.test.ts` is the template and is currently green.
- Vitest dual-project config: these tests live in `.test.ts` (node env, not jsdom) because server components do not render in a DOM. Verified via `vitest.config.ts`.
- `vi.hoisted` is required because `vi.mock` calls are hoisted above imports — the mock functions must be defined before the module loader evaluates them.
- Two assertions per page = 32 assertions total. Tight enough to ship fast, strong enough to catch: (a) wrong resource or action in the gate (REQ-PG.7), (b) wrong redirect target (REQ-PG.2), (c) a future regression where someone removes the gate entirely.

**Rejected — deeper per-page tests** (happy-path data rendering, service-layer integration):
Out of scope — this change is about the gate only. Rendering and service correctness are the existing test surface of each feature.

**Rejected — single consolidated test file** (one `dashboard-rbac.test.ts` iterating all 16 pages):
Fights Vitest's module-per-file mocking model (`vi.mock` is file-scoped). Would require dynamic imports, lose `vi.hoisted` simplicity, and make failure messages opaque.

---

### DCSN-006 — Commit strategy: 2-PR split (bypass vs upgrade) with atomic test+gate per file

**Decision**: Ship in 2 PRs, mirroring the kind column from spec §2:

- **PR1** — 12 `B` (bypass) pages: additive gating. No existing tests to break. Higher volume, lower risk.
- **PR2** — 4 `U` (upgrade) pages: `requireRole` → `requirePermission`. Lower volume, higher semantic risk (behavior change for `financial-statements` and `monthly-close`).

Within each PR: multiple commits allowed if the PR grows long, but each commit is self-contained (gate edit + corresponding test file in the same commit, per DCSN-004).

**Rationale**:
- Reviewer load: PR1 is mechanical review (scan 12 diffs for the same pattern). PR2 needs semantic review (is `reports:read` right for `balance-sheet`? is `journal:read` right for `monthly-close`? — these are the questions a reviewer actually asks, and should be answered from the spec, not buried in a 16-file diff).
- Rollback surface: if something in PR2 misbehaves in production (e.g., a custom role didn't have `reports:read` and suddenly loses access), we revert PR2 without undoing the 12 bypass fixes.
- Precedent: `resource-nav-mapping-fix` (archive #756) DCSN-003 used a similar split.

**Rejected — single commit for all 16**:
Review becomes a scroll-and-LGTM. Fails the "each PR should answer one question" heuristic.

**Rejected — 3+ PRs (e.g., split B into accounting vs others)**:
Over-engineering for a mechanical refactor. 2 PRs already separates the risk axes; more splits burn review cycles without adding safety.

---

## C. File Changes Table

### Source pages (all MODIFY — 16 files)

| # | Path (relative to repo root) | Kind | Resource | Action | Action detail |
|---|------------------------------|------|----------|--------|---------------|
| 1 | `app/(dashboard)/[orgSlug]/dispatches/page.tsx` | B | `sales` | `read` | Replace `requireAuth + requireOrgAccess` chain with `requirePermission`; drop imports from `@/features/shared` |
| 2 | `app/(dashboard)/[orgSlug]/sales/page.tsx` | B | `sales` | `read` | Same pattern |
| 3 | `app/(dashboard)/[orgSlug]/accounting/cxc/page.tsx` | B | `sales` | `read` | Same pattern |
| 4 | `app/(dashboard)/[orgSlug]/accounting/cxp/page.tsx` | B | `purchases` | `read` | Same pattern |
| 5 | `app/(dashboard)/[orgSlug]/payments/page.tsx` | B | `payments` | `read` | Same pattern |
| 6 | `app/(dashboard)/[orgSlug]/purchases/page.tsx` | B | `purchases` | `read` | Same pattern |
| 7 | `app/(dashboard)/[orgSlug]/accounting/journal/page.tsx` | B | `journal` | `read` | Same pattern |
| 8 | `app/(dashboard)/[orgSlug]/accounting/ledger/page.tsx` | B | `journal` | `read` | Same pattern |
| 9 | `app/(dashboard)/[orgSlug]/accounting/contacts/page.tsx` | B | `contacts` | `read` | Same pattern |
| 10 | `app/(dashboard)/[orgSlug]/informes/page.tsx` | B | `reports` | `read` | Same pattern |
| 11 | `app/(dashboard)/[orgSlug]/informes/impuestos/libro-ventas/page.tsx` | B | `reports` | `read` | Same pattern |
| 12 | `app/(dashboard)/[orgSlug]/informes/impuestos/libro-compras/page.tsx` | B | `reports` | `read` | Same pattern |
| 13 | `app/(dashboard)/[orgSlug]/accounting/financial-statements/page.tsx` | U | `reports` | `read` | Remove `requireAuth`, `requireOrgAccess`, `requireRole` calls AND imports; replace with `requirePermission`; redirect `/${orgSlug}` |
| 14 | `app/(dashboard)/[orgSlug]/accounting/financial-statements/balance-sheet/page.tsx` | U | `reports` | `read` | Same as #13 |
| 15 | `app/(dashboard)/[orgSlug]/accounting/financial-statements/income-statement/page.tsx` | U | `reports` | `read` | Same as #13 |
| 16 | `app/(dashboard)/[orgSlug]/accounting/monthly-close/page.tsx` | U | `journal` | `read` | Same as #13 |

### Test files (all CREATE — 16 files)

Discovery confirmed only 2 `__tests__` directories exist under `app/(dashboard)/[orgSlug]/` and neither corresponds to any of the 16 pages. Every test file below is CREATED in this change.

| # | Path | Created mocks beyond baseline |
|---|------|-------------------------------|
| 1 | `app/(dashboard)/[orgSlug]/dispatches/__tests__/page.test.ts` | `@/features/dispatch`, `@/features/sale`, `@/components/dispatches/dispatch-list` |
| 2 | `app/(dashboard)/[orgSlug]/sales/__tests__/page.test.ts` | sales feature service + sales client component |
| 3 | `app/(dashboard)/[orgSlug]/accounting/cxc/__tests__/page.test.ts` | cxc service + cxc client component |
| 4 | `app/(dashboard)/[orgSlug]/accounting/cxp/__tests__/page.test.ts` | cxp service + cxp client component |
| 5 | `app/(dashboard)/[orgSlug]/payments/__tests__/page.test.ts` | payments service + payments client component |
| 6 | `app/(dashboard)/[orgSlug]/purchases/__tests__/page.test.ts` | purchases service + purchases client component |
| 7 | `app/(dashboard)/[orgSlug]/accounting/journal/__tests__/page.test.ts` | journal service + journal client component |
| 8 | `app/(dashboard)/[orgSlug]/accounting/ledger/__tests__/page.test.ts` | ledger service + ledger client component |
| 9 | `app/(dashboard)/[orgSlug]/accounting/contacts/__tests__/page.test.ts` | contacts service + contacts client component |
| 10 | `app/(dashboard)/[orgSlug]/informes/__tests__/page.test.ts` | reports landing client component |
| 11 | `app/(dashboard)/[orgSlug]/informes/impuestos/libro-ventas/__tests__/page.test.ts` | libro-ventas service + client component |
| 12 | `app/(dashboard)/[orgSlug]/informes/impuestos/libro-compras/__tests__/page.test.ts` | libro-compras service + client component |
| 13 | `app/(dashboard)/[orgSlug]/accounting/financial-statements/__tests__/page.test.ts` | `FinancialStatementsLanding` client component |
| 14 | `app/(dashboard)/[orgSlug]/accounting/financial-statements/balance-sheet/__tests__/page.test.ts` | balance-sheet service + client component |
| 15 | `app/(dashboard)/[orgSlug]/accounting/financial-statements/income-statement/__tests__/page.test.ts` | income-statement service + client component |
| 16 | `app/(dashboard)/[orgSlug]/accounting/monthly-close/__tests__/page.test.ts` | monthly-close service + client component |

Exact service/client mocks depend on each page's current imports — resolved during `sdd-apply`, not here. The baseline (mock `next/navigation.redirect` + `@/features/shared/permissions.server.requirePermission`) is fixed by DCSN-005.

### No infrastructure files

- No new `lib/with-permission.ts` (DCSN-001).
- No changes to `proxy.ts` (DCSN-001).
- No changes to `features/shared/permissions.server.ts` (already stable per custom-roles archive #715).
- No changes to the `Resource` union (frozen by DCSN-001 of `resource-nav-mapping-fix`).
- No `requireRole` mock teardown — confirmed none of the 4 `U` pages have existing tests that mock `requireRole`.

---

## D. Risks & Mitigations

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Custom role loses access to `financial-statements` or `monthly-close` after upgrade | Medium | Low | Matrix is the source of truth: any role with `reports:read` (or `journal:read` for monthly-close) gets access. If a custom role previously had those matrix bits but the page blocked them via `requireRole(["owner","admin","contador"])`, this change is a FIX, not a regression. Document in PR2 description. |
| Wrong resource chosen for `/dispatches` page | Low | Low | DCSN-001 from `resource-nav-mapping-fix` (archive #756) froze `sales` as the correct resource for `/dispatches`. Spec REQ-PG.7 enumerates all 16 triples. Test assertion `toHaveBeenCalledWith("sales", "read", ORG_SLUG)` catches drift. |
| `orgId` extracted from `result.orgId` but downstream code expects legacy shape | Low | Low | `requirePermission` returns `{ session, orgId, role }` (verified in `features/shared/permissions.server.ts:48`). `members/page.tsx` and all `settings/**` pages already use `result.orgId`. No legacy shape. |
| `tsc --noEmit` flags orphan `requireAuth`/`requireOrgAccess`/`requireRole` imports after edit | Low | Medium | REQ-PG.13 enforces atomic replacement. Agent must delete the unused import lines in the same edit. `sdd-verify` runs `tsc --noEmit` as acceptance gate. |
| Redirect target change (`/sign-in`/`/select-org` → `/${orgSlug}`) confuses users who hit the 4 `U` pages via bookmark without access | Low | Low | Matches canonical convention; UX already consistent for settings/members. Landing on org dashboard is the safest fallback. |
| Test file proliferation (16 new files) slows CI | Low | High | Each file is ~50 LOC with 2 assertions. Vitest parallelizes. Negligible CI cost vs security value. |
| `requireRole` still callable from non-page code (server actions, API routes) and becomes subtly obsolete | Low | Low | Out of scope — this change targets `page.tsx` only. REQ-PG.8 scopes the regression guard to `app/(dashboard)/**/page.tsx`. Broader deprecation is a follow-up. |

---

## E. Approach Ordering (handoff to sdd-tasks)

Recommended ordering for the task breakdown:

1. **Group 1 — bypass pages (PR1, 12 tasks)** — mechanical, low risk. Each task = 1 page + 1 test file in 1 commit. Order within the group is arbitrary; suggest alphabetical-by-path for reviewer sanity. Each task follows Strict TDD Mode: RED (test asserts the unimplemented gate) → GREEN (add the gate) → REFACTOR (remove orphan imports).
2. **Group 2 — upgrade pages (PR2, 4 tasks)** — `requireRole` → `requirePermission`. Same TDD cadence. Order suggestion: `monthly-close` first (journal:read, singular), then `financial-statements/page.tsx`, then the two children (`balance-sheet`, `income-statement`) which inherit the same semantics from the parent.
3. **Group 3 — regression guard** — a single task that runs `grep -r "requireRole(" app/(dashboard)` and asserts zero matches. Also runs `tsc --noEmit` and the full Vitest suite. This is the REQ-PG.8 + REQ-PG.12 + REQ-PG.13 acceptance gate and is the last item before `sdd-verify`.

Total expected tasks for `sdd-tasks`: 16 page-edit tasks + 1 regression-guard task = **17 tasks**, distributed across 2 PRs.

---

## F. Skill Resolution

injected — compact rules arrived from orchestrator prompt:
- Next.js 16.2.1 breaking-change rule respected (no `proxy.ts` RBAC, no `middleware.ts` references).
- TypeScript 5.9.3 strict rule respected (no `any`, no `!`, `let orgId: string` pattern).
- React 19.2.4 server-component default respected (tests run in node env per Vitest dual-project config).
- Clerk 7.0.7 auth cascade respected (DCSN-003 delegates unauth bounce to Clerk middleware).
- Resource union freeze respected (DCSN-001 of `resource-nav-mapping-fix`).
- Conventional commits + no AI attribution respected (commit strategy in DCSN-006).
- Rioplatense voseo warm tone — this is an English design doc per project convention (openspec artifacts are English); narrative in PR descriptions will use voseo.

---

## Return Envelope

- **status**: COMPLETE
- **executive_summary**: Design locks in 6 decisions for the 16-page RBAC gating fix. DCSN-001 rejects HOF and proxy.ts in favor of inline `requirePermission` per canonical convention. DCSN-002 standardizes `let orgId: string` with single try/catch. DCSN-003 fixes redirect target to `/${orgSlug}`. DCSN-004 enforces atomic gate+test migration for the 4 `requireRole` pages. DCSN-005 pins the test pattern (`vi.hoisted` + 2 mocks + 2 assertions per page). DCSN-006 splits into 2 PRs by risk (bypass vs upgrade). Discovery confirmed zero existing `requireRole` test mocks exist for the 4 upgrade pages — eliminating the "mock cascade" risk from the proposal. File changes: 16 MODIFY (pages) + 16 CREATE (tests). No new infrastructure.
- **artifacts**: `openspec/changes/rbac-page-gating-fix/design.md` + engram topic `sdd/rbac-page-gating-fix/design`
- **next_recommended**: `sdd-tasks` (17 tasks, 2-PR split)
- **risks**: See §D — dominant risk is matrix semantics on the 4 `U` pages; mitigated by explicit per-page resource:action assertions and PR2 isolation.
- **skill_resolution**: injected
