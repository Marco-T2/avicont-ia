# Spec: rbac-page-gating

**Change**: rbac-page-gating-fix
**Date**: 2026-04-18
**Status**: APPROVED
**Artifact Store**: hybrid (engram + filesystem)
**Proposal**: openspec/changes/rbac-page-gating-fix/proposal.md

---

## 1. Capability

**`rbac-page-gating`** — Server-side page-level RBAC enforcement layer.

Every dashboard `page.tsx` rendering sensitive module data MUST call `requirePermission(resource, action, orgSlug)` before producing any output. On any failure — auth, org membership, or role permission — the page MUST redirect without rendering. This fills the gap between the API-layer enforcement (`rbac-permissions-matrix`) and the client-side UI gating (`rbac-ui-gating`).

As of 2026-04-19, **36 pages** across Tier A/B/C are gated: 16 initial pages (REQ-PG.1–13, shipped 2026-04-18) + 20 legacy migration pages (REQ-PG.14–15, shipped 2026-04-19). The 4 intentional Tier B exceptions (farms, lots, accounting hub) remain on legacy auth-only per documented decision.

### Capability Boundaries

| Layer | Enforcement | Out of Scope for This Spec |
|-------|-------------|---------------------------|
| Page layer (this spec) | `requirePermission` in `page.tsx` | — |
| API layer | `rbac-permissions-matrix` spec | route handlers, service methods |
| Client layer | `rbac-ui-gating` spec | `<Gated>`, `useCanAccess()`, sidebar |

### Canonical Implementation Pattern

```typescript
// Correct — one try/catch, one call
let orgId: string;
try {
  const result = await requirePermission("resource", "read", orgSlug);
  orgId = result.orgId;
} catch {
  redirect(`/${orgSlug}`);
}
```

`requirePermission` is imported from `@/features/shared/permissions.server` (server-only module). It internally calls `requireAuth()` → `requireOrgAccess()` → matrix lookup → `requireRole()`. All failure modes throw, and the single catch redirects to the org root.

---

## 2. Scope Boundary

### In Scope — 16 Pages

| # | Page path (under `app/(dashboard)/[orgSlug]/`) | Resource | Action | Kind |
|---|------------------------------------------------|----------|--------|------|
| 1 | `dispatches/page.tsx` | `sales` | `read` | B |
| 2 | `sales/page.tsx` | `sales` | `read` | B |
| 3 | `accounting/cxc/page.tsx` | `sales` | `read` | B |
| 4 | `accounting/cxp/page.tsx` | `purchases` | `read` | B |
| 5 | `payments/page.tsx` | `payments` | `read` | B |
| 6 | `purchases/page.tsx` | `purchases` | `read` | B |
| 7 | `accounting/journal/page.tsx` | `journal` | `read` | B |
| 8 | `accounting/ledger/page.tsx` | `journal` | `read` | B |
| 9 | `accounting/contacts/page.tsx` | `contacts` | `read` | B |
| 10 | `informes/page.tsx` | `reports` | `read` | B |
| 11 | `informes/impuestos/libro-ventas/page.tsx` | `reports` | `read` | B |
| 12 | `informes/impuestos/libro-compras/page.tsx` | `reports` | `read` | B |
| 13 | `accounting/financial-statements/page.tsx` | `reports` | `read` | U |
| 14 | `accounting/financial-statements/balance-sheet/page.tsx` | `reports` | `read` | U |
| 15 | `accounting/financial-statements/income-statement/page.tsx` | `reports` | `read` | U |
| 16 | `accounting/monthly-close/page.tsx` | `journal` | `read` | U |

**B** = bypass — currently `requireAuth + requireOrgAccess` only; add `requirePermission` gate.
**U** = upgrade — currently `requireRole([...])` hardcoded slugs; replace with `requirePermission`.

### Out of Scope

- **`requirePermission` implementation** — frozen, DB-backed, 62+ call sites; no changes.
- **`Resource` union** — frozen (DCSN-001). `sales` covers dispatches at page layer; `dispatches` resource used only in API/write paths. This is intentional.
- **No wrapper utility** (`lib/with-permission.ts`) — direct-call convention is established and consistent.
- **No `proxy.ts`** — Next.js 16 has no middleware-to-page proxy; verified in `node_modules/next/dist/docs/`.
- **MEDIUM sub-pages deferred**: `accounting/accounts`, `accounting/balances`, `accounting/correlation-audit`, `accounting/reports`, `settings/periods` — parent page gates provide nav barrier.
- **No schema changes, no new API routes, no new DB migrations.**

---

## 3. Requirements

### REQ-PG.1 — Gate Invocation

**GIVEN** any of the 16 listed pages is requested  
**WHEN** the server component executes  
**THEN** `requirePermission(resource, action, orgSlug)` MUST be called before any service data fetch or JSX render  
**AND** `resource` and `action` MUST match the mapping in the Scope table above  
**AND** `orgSlug` MUST be the value destructured from `await params`

**Scenarios:**

```
GIVEN dispatches/page.tsx is requested with orgSlug="acme"
WHEN the page renders
THEN requirePermission("sales", "read", "acme") is called before HubService.listHub()

GIVEN accounting/journal/page.tsx is requested
WHEN the page renders
THEN requirePermission("journal", "read", orgSlug) is called

GIVEN accounting/financial-statements/page.tsx is requested
WHEN the page renders
THEN requirePermission("reports", "read", orgSlug) is called
  AND NOT requireRole([...]) is called anywhere in that page
```

---

### REQ-PG.2 — Permission Failure Redirect

**GIVEN** `requirePermission` throws for any permission reason (role has no read on resource)  
**WHEN** the catch block executes  
**THEN** the page MUST call `redirect(\`/${orgSlug}\`)` — the org dashboard root  
**AND** the page MUST NOT call `redirect("/sign-in")` or `redirect("/select-org")`  
**AND** no page content MUST be rendered

**Rationale**: Clerk middleware handles unauthenticated sessions before the page is reached. Redirecting to `/sign-in` in page code is dead code for the auth case and wrong UX for the permission case (authenticated user sent to login screen). Org root is the safe fallback for authorized org members lacking a specific resource permission.

**Scenarios:**

```
GIVEN a user has role "member" (no reports:read in matrix)
WHEN they request informes/page.tsx
THEN redirect("/${orgSlug}") is called
  AND redirect("/sign-in") is NOT called

GIVEN a user has role "cobrador" (no journal:read in matrix)
WHEN they request accounting/monthly-close/page.tsx
THEN redirect("/${orgSlug}") is called
```

---

### REQ-PG.3 — Auth Failure Cascade

**GIVEN** no authenticated Clerk session exists  
**WHEN** `requirePermission` is called  
**THEN** the internal `requireAuth()` call throws  
**AND** `requirePermission` re-throws  
**AND** the page catch block calls `redirect(\`/${orgSlug}\`)`  
**AND** Clerk middleware intercepts the redirect and bounces to sign-in

**Note**: Pages do NOT need a separate `requireAuth()` try/catch. The cascade through `requirePermission` is sufficient and is the correct convention. Clerk middleware provides the final auth bounce.

**Scenarios:**

```
GIVEN request has no Clerk session token
WHEN dispatches/page.tsx executes requirePermission(...)
THEN requireAuth() inside requirePermission throws
  AND requirePermission re-throws
  AND catch block calls redirect(`/${orgSlug}`)
  AND Clerk middleware intercepts and sends user to sign-in
```

---

### REQ-PG.4 — Org Access Failure Cascade

**GIVEN** the user is authenticated (has Clerk session)  
**AND** the user is NOT a member of the org identified by `orgSlug`  
**WHEN** `requirePermission` is called  
**THEN** the internal `requireOrgAccess(userId, orgSlug)` call throws  
**AND** `requirePermission` re-throws  
**AND** the page catch block calls `redirect(\`/${orgSlug}\`)`

**Scenarios:**

```
GIVEN user "u-2" is authenticated but not a member of org "acme"
WHEN they request /acme/sales/page.tsx
THEN requireOrgAccess("u-2", "acme") throws inside requirePermission
  AND catch block calls redirect("/acme")
```

---

### REQ-PG.5 — Matrix-Compliant Role Renders Page

**GIVEN** the user's role (system OR custom) has `read` permission on the page's resource in the org's permission matrix  
**WHEN** `requirePermission` resolves  
**THEN** the page MUST render normally  
**AND** `result.orgId` MUST be available for downstream service calls

**Scenarios:**

```
GIVEN role "owner" (has read on all resources by default matrix)
WHEN they request any of the 16 pages
THEN requirePermission resolves with { orgId, session, role }
  AND page renders

GIVEN a custom role "contador-especial" with reports:read in the org matrix
WHEN they request informes/page.tsx
THEN requirePermission resolves
  AND page renders CatalogPage component

GIVEN role "admin" (has journal:read by default matrix)
WHEN they request accounting/journal/page.tsx
THEN requirePermission resolves
  AND page renders journal list
```

---

### REQ-PG.6 — Matrix-Non-Compliant Role Redirects

**GIVEN** the user's role does NOT have `read` permission on the page's resource in the matrix  
**WHEN** `requirePermission` throws  
**THEN** the page MUST call `redirect(\`/${orgSlug}\`)`  
**AND** no page service data is fetched

**Scenarios:**

```
GIVEN role "member" (no purchases:read in default matrix)
WHEN they request purchases/page.tsx
THEN requirePermission throws
  AND redirect("/acme") is called
  AND PurchaseService is NOT invoked

GIVEN a custom role "lector-ventas" with ONLY sales:read (no reports:read)
WHEN they request informes/impuestos/libro-ventas/page.tsx
THEN requirePermission throws
  AND redirect("/${orgSlug}") is called

GIVEN role "cobrador" (no journal:read in default matrix)
WHEN they request accounting/ledger/page.tsx
THEN redirect("/${orgSlug}") is called
```

---

### REQ-PG.7 — Resource:Action Mapping (Complete Enumeration)

All 16 pages MUST use exactly the resource:action pair specified below. No deviation, no aliasing.

| Page | resource | action |
|------|----------|--------|
| `dispatches/page.tsx` | `sales` | `read` |
| `sales/page.tsx` | `sales` | `read` |
| `accounting/cxc/page.tsx` | `sales` | `read` |
| `accounting/cxp/page.tsx` | `purchases` | `read` |
| `payments/page.tsx` | `payments` | `read` |
| `purchases/page.tsx` | `purchases` | `read` |
| `accounting/journal/page.tsx` | `journal` | `read` |
| `accounting/ledger/page.tsx` | `journal` | `read` |
| `accounting/contacts/page.tsx` | `contacts` | `read` |
| `informes/page.tsx` | `reports` | `read` |
| `informes/impuestos/libro-ventas/page.tsx` | `reports` | `read` |
| `informes/impuestos/libro-compras/page.tsx` | `reports` | `read` |
| `accounting/financial-statements/page.tsx` | `reports` | `read` |
| `accounting/financial-statements/balance-sheet/page.tsx` | `reports` | `read` |
| `accounting/financial-statements/income-statement/page.tsx` | `reports` | `read` |
| `accounting/monthly-close/page.tsx` | `journal` | `read` |

**Note on `dispatches` resource**: The `dispatches` resource is intentionally absent from page-level gating. At the page layer, `/dispatches` maps to `sales:read` because dispatches are a sub-feature of the sales module accessible to all sales-role users. The `dispatches` resource string is used only at write-API level. This mapping is documented in `resource-nav-mapping-fix archive #756`.

---

### REQ-PG.8 — requireRole Anti-Pattern Prohibition

**GIVEN** production page code in `app/(dashboard)/**/page.tsx`  
**THEN** `requireRole([...])` with hardcoded slug arrays MUST NOT be called for page gating  
**BECAUSE** it bypasses the org-specific permission matrix, making custom roles invisible to the gate

**Verification**: After implementation, `grep -r "requireRole(" app/(dashboard)` MUST return zero matches in any `page.tsx` file.

**Anti-pattern example** (DO NOT DO THIS):
```typescript
// WRONG — bypasses custom-role matrix
await requireRole(userId, orgId, ["owner", "admin", "contador"]);
```

**Correct pattern** (DO THIS):
```typescript
// CORRECT — matrix-driven, custom-role aware
const result = await requirePermission("reports", "read", orgSlug);
orgId = result.orgId;
```

---

### REQ-PG.9 — requireRole Migration (4 Pages)

**GIVEN** these 4 pages currently use `requireRole([...])`:
1. `accounting/financial-statements/page.tsx` — `["owner", "admin", "contador"]`
2. `accounting/financial-statements/balance-sheet/page.tsx` — `["owner", "admin", "contador"]`
3. `accounting/financial-statements/income-statement/page.tsx` — `["owner", "admin", "contador"]`
4. `accounting/monthly-close/page.tsx` — `["owner", "admin"]`

**WHEN** these pages are updated  
**THEN** each MUST replace its entire `requireAuth + requireOrgAccess + requireRole` triple try/catch chain with a single `requirePermission("reports"|"journal", "read", orgSlug)` call  
**AND** a custom role with `reports:read` or `journal:read` in the org matrix MUST now be able to access these pages  
**AND** a user with only hardcoded system role "owner" still accesses (system roles are in the matrix)

**Migration before/after:**

```typescript
// BEFORE (financial-statements/page.tsx)
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
try {
  await requireRole(userId, orgId, ["owner", "admin", "contador"]);
} catch {
  redirect(`/${orgSlug}`);
}

// AFTER
let orgId: string;
try {
  const result = await requirePermission("reports", "read", orgSlug);
  orgId = result.orgId;
} catch {
  redirect(`/${orgSlug}`);
}
```

---

### REQ-PG.10 — orgId Extraction Pattern

**GIVEN** the page needs `orgId` for downstream service calls  
**WHEN** `requirePermission` resolves  
**THEN** `orgId` MUST be destructured from `result.orgId`  
**AND** MUST NOT be obtained via a separate `requireOrgAccess` call after `requirePermission`  
**AND** `result` typing is `{ session: Session, orgId: string, role: string }` — use as-is, no `as`

**Pattern:**
```typescript
let orgId: string;
try {
  const result = await requirePermission("payments", "read", orgSlug);
  orgId = result.orgId;   // ← extract here
} catch {
  redirect(`/${orgSlug}`);
}

// Use orgId freely below — TypeScript knows it's assigned after the try block
const data = await someService.list(orgId);
```

**Note**: TypeScript requires `orgId` to be declared before the try/catch (as `let orgId: string`) so it is in scope after the block. This matches the pattern used in `members/page.tsx` and all `settings/**` pages.

---

### REQ-PG.11 — Test Coverage (Per Page)

**GIVEN** each of the 16 listed pages  
**THEN** a test file MUST exist at `app/(dashboard)/[orgSlug]/{page-path}/__tests__/page-rbac.test.ts`  
**AND** each test file MUST assert at minimum:

**(a) Authorized path**: role with `read` on the resource → `requirePermission` resolves → page renders → `redirect` NOT called

**(b) Forbidden path**: role without `read` on the resource → `requirePermission` throws → `redirect(\`/${orgSlug}\`)` IS called

**Reference test structure** (from `settings/roles/__tests__/page.test.ts`):
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
// Mock any service or client component the page imports

import PageComponent from "../page";

describe("/path/to/page — rbac gate", () => {
  it("renders when requirePermission resolves", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-1" });
    await PageComponent({ params: Promise.resolve({ orgSlug: "acme" }) });
    expect(mockRequirePermission).toHaveBeenCalledWith("resource", "read", "acme");
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to org root when requirePermission throws", async () => {
    mockRequirePermission.mockRejectedValue(new Error("forbidden"));
    await PageComponent({ params: Promise.resolve({ orgSlug: "acme" }) });
    expect(mockRedirect).toHaveBeenCalledWith("/acme");
  });
});
```

**TDD Order**: Write the failing test FIRST (RED), then edit the page (GREEN), then clean up (REFACTOR).

**Pages that already have tests** (update mock from `requireRole` to `requirePermission`):
- `accounting/financial-statements/__tests__/page.test.ts` (if exists)
- `accounting/monthly-close/__tests__/page.test.ts` (if exists)

---

### REQ-PG.12 — TypeScript Cleanliness

**GIVEN** all 16 page edits are complete  
**WHEN** `tsc --noEmit` is run at the project root  
**THEN** zero type errors MUST be produced  
**AND** no `any` introduced  
**AND** no unjustified `as` casts introduced  
**AND** `orgId` MUST be declared as `string` (not `string | undefined`) — the try/catch assignment pattern with `let orgId: string` guarantees definite assignment for TypeScript strict mode

---

### REQ-PG.13 — Atomic Removal of Old Pattern

**GIVEN** the 8 bypass pages currently using `requireAuth + requireOrgAccess` double try/catch  
**AND** the 4 upgrade pages using `requireAuth + requireOrgAccess + requireRole` triple try/catch  
**WHEN** each page is edited  
**THEN** the ENTIRE old auth chain MUST be replaced atomically with the single `requirePermission` call  
**AND** no orphan `requireAuth` or `requireOrgAccess` calls MAY remain in the page body  
**AND** `requireAuth` and `requireOrgAccess` imports MUST be removed from the page's import list if they are no longer used elsewhere in the file

**Verification**: After each edit, the page MUST import ONLY `requirePermission` from `@/features/shared/permissions.server` for auth purposes. The old `@/features/shared` or `@/features/shared/middleware` imports for auth functions must be gone.

---

### REQ-PG.14 — Legacy Auth-Chain Migration Mapping (20 Pages)

Every page listed below MUST replace its legacy `requireAuth + requireOrgAccess` double try/catch with a single `requirePermission(resource, action, orgSlug)` call following the canonical pattern (DCSN-002/003). The resource:action pair for each page is canonical and MUST NOT deviate.

| Page path (under `app/(dashboard)/[orgSlug]/`) | resource | action |
|---|---|---|
| `dispatches/new/page.tsx` | `sales` | `write` |
| `dispatches/[dispatchId]/page.tsx` | `sales` | `write` |
| `sales/new/page.tsx` | `sales` | `write` |
| `sales/[saleId]/page.tsx` | `sales` | `write` |
| `purchases/new/page.tsx` | `purchases` | `write` |
| `purchases/[purchaseId]/page.tsx` | `purchases` | `write` |
| `payments/new/page.tsx` | `payments` | `write` |
| `payments/[paymentId]/page.tsx` | `payments` | `write` |
| `accounting/accounts/page.tsx` | `accounting-config` | `read` |
| `accounting/balances/page.tsx` | `journal` | `read` |
| `accounting/correlation-audit/page.tsx` | `journal` | `read` |
| `accounting/reports/page.tsx` | `reports` | `read` |
| `accounting/journal/new/page.tsx` | `journal` | `write` |
| `accounting/journal/[entryId]/page.tsx` | `journal` | `read` |
| `accounting/journal/[entryId]/edit/page.tsx` | `journal` | `write` |
| `accounting/contacts/[contactId]/page.tsx` | `contacts` | `read` |
| `settings/periods/page.tsx` | `accounting-config` | `write` |
| `settings/voucher-types/page.tsx` | `accounting-config` | `write` |
| `settings/operational-doc-types/page.tsx` | `accounting-config` | `write` |
| `settings/product-types/page.tsx` | `accounting-config` | `write` |

**Action rationale**: `new/` and `edit/` paths use `write`. Detail pages that render a read-only view use `read`. Detail pages that render an edit form (e.g. `[dispatchId]`, `[saleId]`, `[purchaseId]`, `[paymentId]`) use `write` — verified by reading page code (edit forms, not read-only views).

#### Scenario: Authorized user accesses form page — gate passes

- GIVEN a user whose role has `sales:write` in the org matrix
- WHEN they request `dispatches/new/page.tsx` with a valid `orgSlug`
- THEN `requirePermission("sales", "write", orgSlug)` resolves
- AND the page renders `DispatchForm` without calling `redirect`

#### Scenario: Unauthorized user accesses form page — redirected

- GIVEN a user whose role does NOT have `sales:write` in the org matrix
- WHEN they request `sales/new/page.tsx`
- THEN `requirePermission("sales", "write", orgSlug)` throws
- AND `redirect(\`/${orgSlug}\`)` is called
- AND no service data is fetched

#### Scenario: Authorized user accesses read-only accounting page — gate passes

- GIVEN a user whose role has `journal:read` in the org matrix
- WHEN they request `accounting/balances/page.tsx`
- THEN `requirePermission("journal", "read", orgSlug)` resolves
- AND `BalanceTable` renders

#### Scenario: Unauthorized user accesses accounting-config page — redirected

- GIVEN a user whose role does NOT have `accounting-config:write` in the org matrix
- WHEN they request `settings/periods/page.tsx`
- THEN `requirePermission("accounting-config", "write", orgSlug)` throws
- AND `redirect(\`/${orgSlug}\`)` is called

#### Scenario: No orphan legacy imports remain after migration

- GIVEN all 20 pages have been migrated
- WHEN `grep -E "requireAuth\(|requireOrgAccess\(" app/(dashboard)/[orgSlug]/**/page.tsx` runs
- THEN it returns ONLY the 4 Tier B exception pages

---

### REQ-PG.15 — Tier B Intentional Auth-Only Exceptions

The following 4 pages MUST remain on the legacy `requireAuth + requireOrgAccess` chain WITHOUT `requirePermission`. Each page MUST carry an inline code comment marker immediately above the auth block:

```typescript
// RBAC-EXCEPTION: <reason>
```

| Page | Reason |
|---|---|
| `farms/page.tsx` | Cross-module auth-only; no farms resource in frozen `Resource` union. User decision 2026-04-19. |
| `farms/[farmId]/page.tsx` | Cross-module auth-only; no farms resource in frozen `Resource` union. User decision 2026-04-19. |
| `lots/[lotId]/page.tsx` | Cross-module auth-only; no lots resource in frozen `Resource` union. User decision 2026-04-19. |
| `accounting/page.tsx` | Dashboard hub with summary cards only; all sub-sections carry their own `requirePermission` gate. Hub-level gate is redundant. |

**Future prohibition**: Any NEW `page.tsx` created under `app/(dashboard)/[orgSlug]/` MUST either use `requirePermission` OR carry an `// RBAC-EXCEPTION: <reason>` marker. The legacy chain without a marker is forbidden for new pages.

#### Scenario: Tier B page missing RBAC-EXCEPTION marker — detected

- GIVEN a Tier B page (e.g. `farms/page.tsx`) does NOT have an `// RBAC-EXCEPTION:` comment
- WHEN a grep gate runs: `grep -rL "RBAC-EXCEPTION" app/(dashboard)/[orgSlug]/farms/page.tsx`
- THEN the file appears in output (i.e. marker is absent)
- AND this constitutes a failing condition in the verify phase

#### Scenario: Authenticated org member views Tier B page — page renders

- GIVEN a user is authenticated and a member of the org
- AND `farms/page.tsx` uses `requireAuth + requireOrgAccess` (no `requirePermission`)
- WHEN they request `/${orgSlug}/farms`
- THEN `requireAuth` and `requireOrgAccess` resolve
- AND the page renders `FarmsPageClient` without a permission matrix check

#### Scenario: New page uses legacy chain without marker — violation

- GIVEN a new `page.tsx` is added under `app/(dashboard)/[orgSlug]/some-feature/`
- WHEN it uses `requireAuth + requireOrgAccess` without `requirePermission` AND without `// RBAC-EXCEPTION:`
- THEN this MUST be flagged as a pattern violation in code review / verify phase

---

## 4. Capability Scenarios (Full)

### Scenario A — Owner role, page renders (happy path)

```
GIVEN user "u-owner" has role "owner" in org "demo"
  AND "owner" has reports:read in the org permission matrix
WHEN they navigate to /demo/informes
THEN requirePermission("reports", "read", "demo") is called
  AND it resolves with { orgId: "org-demo", session, role: "owner" }
  AND the page renders <CatalogPage orgSlug="demo" />
  AND redirect is NOT called
```

### Scenario B — Custom role with matrix read, page renders

```
GIVEN org "demo" has a custom role "analista" with reports:read = true in the matrix
  AND user "u-analista" has role "analista"
WHEN they navigate to /demo/accounting/financial-statements/balance-sheet
THEN requirePermission("reports", "read", "demo") resolves
  AND the page renders <BalanceSheet ... />
  AND redirect is NOT called
  AND this was PREVIOUSLY blocked by requireRole(["owner","admin","contador"]) — now unblocked
```

### Scenario C — Custom role without matrix read, redirect

```
GIVEN org "demo" has a custom role "vendedor" with sales:read = true, reports:read = false
  AND user "u-vendedor" has role "vendedor"
WHEN they navigate to /demo/informes
THEN requirePermission("reports", "read", "demo") throws (forbidden)
  AND redirect("/demo") is called
  AND no report content is rendered
```

### Scenario D — Unauthenticated user, Clerk redirect chain

```
GIVEN no Clerk session exists for the request
WHEN server component for /demo/payments executes
THEN requirePermission("payments", "read", "demo") is called
  AND requireAuth() inside it throws (no session)
  AND requirePermission re-throws
  AND catch block calls redirect("/demo")
  AND Clerk middleware intercepts /demo redirect and sends to sign-in
```

### Scenario E — User not in org, redirect

```
GIVEN user "u-ext" is authenticated (valid Clerk session)
  AND user "u-ext" is NOT a member of org "demo"
WHEN they navigate to /demo/purchases
THEN requirePermission("purchases", "read", "demo") is called
  AND requireOrgAccess("u-ext", "demo") inside it throws
  AND requirePermission re-throws
  AND catch block calls redirect("/demo")
```

### Scenario F — requireRole upgrade, previously hardcoded slugs blocked custom roles

```
GIVEN org "demo" has custom role "analista-financiero" with reports:read in matrix
BEFORE: accounting/financial-statements/page.tsx uses requireRole(["owner","admin","contador"])
  AND "analista-financiero" is NOT in ["owner","admin","contador"]
  → user with "analista-financiero" gets redirect (WRONG behavior)

AFTER: page uses requirePermission("reports", "read", orgSlug)
  AND matrix has "analista-financiero" with reports:read = true
  → user with "analista-financiero" gets page rendered (CORRECT behavior)
```

### Scenario G — Dispatches page uses sales:read (resource mapping)

```
GIVEN user has role "contador" (sales:read in matrix, but no dispatches resource in page-layer)
WHEN they navigate to /demo/dispatches
THEN requirePermission("sales", "read", "demo") is called (NOT "dispatches")
  AND it resolves (contador has sales:read)
  AND page renders dispatch list
```

### Scenario H — tsc clean after all edits

```
GIVEN all 16 pages have been edited
WHEN tsc --noEmit runs
THEN exit code is 0
  AND no errors on orgId type (let orgId: string is definite after try block)
  AND no errors from removed imports
```

---

## 5. Acceptance Criteria

- [ ] **REQ-PG.1–PG.7**: All 16 pages call `requirePermission` with correct resource:action before any data fetch
- [ ] **REQ-PG.2**: Redirect target is `/${orgSlug}` in all 16 pages — no `/sign-in` or `/select-org`
- [ ] **REQ-PG.8**: `grep -r "requireRole(" app/(dashboard)` returns zero matches in any `page.tsx`
- [ ] **REQ-PG.9**: Custom role with `reports:read` or `journal:read` can now access financial-statements and monthly-close pages
- [ ] **REQ-PG.10**: All pages extract `orgId` from `result.orgId` — no separate `requireOrgAccess` call
- [ ] **REQ-PG.11**: 16 test files exist; each has authorized-renders and forbidden-redirects assertions
- [ ] **REQ-PG.12**: `tsc --noEmit` exits 0 after all 16 edits
- [ ] **REQ-PG.13**: No orphan `requireAuth` / `requireOrgAccess` imports or calls remain in any of the 16 pages
- [ ] **REQ-PG.14**: All 20 pages call `requirePermission` with the exact resource:action from the mapping table
- [ ] **REQ-PG.14**: No orphan `requireAuth` / `requireOrgAccess` calls remain in any of the 20 migrated pages
- [ ] **REQ-PG.14**: 20 test files exist per DCSN-005 pattern (RED → GREEN → REFACTOR)
- [ ] **REQ-PG.15**: All 4 Tier B pages have `// RBAC-EXCEPTION: <reason>` marker
- [ ] **REQ-PG.15**: `grep -E "requireAuth\(|requireOrgAccess\(" app/(dashboard)/[orgSlug]/**/page.tsx` returns EXACTLY 4 files (the Tier B set)
- [ ] `tsc --noEmit` exits 0 after all 20 edits

---

## 6. Non-Requirements (Explicit Exclusions)

- This spec does NOT require changes to `requirePermission` internals.
- This spec does NOT require changes to the `Resource` union or the permissions matrix schema.
- This spec does NOT require new API routes or middleware.
- This spec does NOT cover sub-pages (`accounting/accounts`, `settings/periods`, etc.) — deferred.
- This spec does NOT require a shared HOF or wrapper utility.

---

## 7. Dependencies

| Dependency | Status | Reference |
|------------|--------|-----------|
| `requirePermission(resource, action, orgSlug)` — stable, DB-backed | Shipped | custom-roles archive #715 |
| `Resource` union — frozen (DCSN-001) | Frozen | permissions.ts |
| Clerk `auth()` — server-side session | Stable | Clerk 7.0.7 |
| `resource-nav-mapping-fix` — dispatches→sales mapping rationale | Archived | #756 |
| Strict TDD Mode | Active | sdd-init |

---

## Return Envelope

- **status**: COMPLETE
- **artifacts**: `openspec/changes/rbac-page-gating-fix/specs/rbac-page-gating/spec.md` + engram topic `sdd/rbac-page-gating-fix/spec`
- **next_recommended**: `sdd-design` (parallelizable with no additional spec) → `sdd-tasks`
- **risks**:
  - Medium: Test mocks for upgraded `requireRole` pages need rewriting to mock `requirePermission` instead — must update in same commit as page edit to stay GREEN
  - Low: `orgId` declared as `let orgId: string` — TypeScript strict requires this exact pattern; `let orgId: string | undefined` causes downstream type errors on service calls
- **skill_resolution**: injected
