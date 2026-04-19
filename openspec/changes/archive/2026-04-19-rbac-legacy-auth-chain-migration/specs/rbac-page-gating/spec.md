# Delta for rbac-page-gating

**Change**: rbac-legacy-auth-chain-migration
**Date**: 2026-04-19
**Base Spec**: openspec/specs/rbac-page-gating/spec.md (REQ-PG.1–PG.13 shipped)
**Status**: DRAFT

---

## ADDED Requirements

### Requirement: REQ-PG.14 — Legacy Auth-Chain Migration Mapping (20 Pages)

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

**Note on proposal discrepancy**: The proposal listed `dispatches/[dispatchId]` → `sales:read` and similar detail pages as `read`, but code inspection reveals these render edit forms. This spec uses `write` for all edit-form detail pages. See risks section.

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

### Requirement: REQ-PG.15 — Tier B Intentional Auth-Only Exceptions

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

## Acceptance Criteria (Delta)

- [ ] **REQ-PG.14**: All 20 pages call `requirePermission` with the exact resource:action from the mapping table
- [ ] **REQ-PG.14**: No orphan `requireAuth` / `requireOrgAccess` calls remain in any of the 20 migrated pages
- [ ] **REQ-PG.14**: 20 test files exist per DCSN-005 pattern (RED → GREEN → REFACTOR)
- [ ] **REQ-PG.15**: All 4 Tier B pages have `// RBAC-EXCEPTION: <reason>` marker
- [ ] **REQ-PG.15**: `grep -E "requireAuth\(|requireOrgAccess\(" app/(dashboard)/[orgSlug]/**/page.tsx` returns EXACTLY 4 files (the Tier B set)
- [ ] `tsc --noEmit` exits 0 after all 20 edits
