# Proposal: RBAC Page Gating Fix

**Date**: 2026-04-18 | **Status**: DRAFT | **Artifact Store**: hybrid
**Prior**: explore #758, resource-nav-mapping-fix #756

## Intent

16 dashboard `page.tsx` bypass the dynamic RBAC matrix: 8 have no gate, 4 use `requireRole([...])` hardcoded slugs (wrong gate), 4 more (contacts, informes, libro-ventas/compras) are gateless. Any authenticated org member can direct-URL them. Fix: enforce matrix page-level via canonical `requirePermission` (already in `settings/**`, `members/page.tsx`).

## Scope

### In Scope — 16 pages under `app/(dashboard)/[orgSlug]/` — B=bypass add, U=upgrade `requireRole`

| Page | Resource:Action | Kind | Section |
|------|-----------------|------|---------|
| `dispatches/page.tsx` | `sales:read` | B | Dispatches/Sales |
| `sales/page.tsx` | `sales:read` | B | Dispatches/Sales |
| `accounting/cxc/page.tsx` | `sales:read` | B | Accounting |
| `accounting/cxp/page.tsx` | `purchases:read` | B | Accounting |
| `payments/page.tsx` | `payments:read` | B | Payments/Purchases |
| `purchases/page.tsx` | `purchases:read` | B | Payments/Purchases |
| `accounting/journal/page.tsx` | `journal:read` | B | Accounting |
| `accounting/ledger/page.tsx` | `journal:read` | B | Accounting |
| `accounting/contacts/page.tsx` | `contacts:read` | B | Accounting |
| `informes/page.tsx` | `reports:read` | B | Informes |
| `informes/impuestos/libro-ventas/page.tsx` | `reports:read` | B | Informes |
| `informes/impuestos/libro-compras/page.tsx` | `reports:read` | B | Informes |
| `accounting/financial-statements/page.tsx` | `reports:read` | U | Reports |
| `accounting/financial-statements/balance-sheet/page.tsx` | `reports:read` | U | Reports |
| `accounting/financial-statements/income-statement/page.tsx` | `reports:read` | U | Reports |
| `accounting/monthly-close/page.tsx` | `journal:read` | U | Reports |

Tests: per-page `__tests__/*-rbac.test.ts` (new/updated).

### Out of Scope
- No wrapper util (`lib/with-permission.ts`).
- No `proxy.ts` (Next.js 16) — perf + Server Function gap, verified in `node_modules/next/dist/docs/`.
- `Resource` union NOT modified (DCSN-001 frozen).
- MEDIUM sub-pages deferred: `accounting/accounts|balances|correlation-audit|reports`, `settings/periods`.
- No follow-ups (rbac-constants-consolidation).

## Capabilities

**New**: `rbac-page-gating` — every dashboard `page.tsx` rendering sensitive module data MUST call `requirePermission(resource, action, orgSlug)` and redirect `/${orgSlug}` on failure; resource maps to nav-item resource.

**Modified**: None. `rbac-permissions-matrix` covers API-layer; this adds parallel page-layer without altering existing requirements.

## Approach

Page-by-page `requirePermission` (explore Approach A). Each page replaces its auth chain with one `requirePermission` call inside one try/catch; failure redirects `/${orgSlug}` (Clerk bounces unauth → sign-in). `orgId` from result. Upgrade pages swap hardcoded slugs for correct resource.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `requireRole` upgrade breaks test mocks | M | TDD, update mocks same commit |
| `orgId` extraction pattern change | L | tsc strict catches misses |
| Redirect shift `/sign-in` → `/${orgSlug}` | L | Clerk bounces unauth; matches settings/** |
| Test fallout on upgraded pages | M | Run suite before PR |
| `/dispatches` page gate (`sales`) ≠ raw API (`dispatches`) | L | Documented in #756 |

## Rollback Plan

Single commit revert. No DB migration, no schema change. `requirePermission` untouched.

## Dependencies

- `requirePermission` stable (custom-roles archive #715, confirmed #756).
- `Resource` union frozen (DCSN-001).
- Strict TDD Mode active.

## Success Criteria

- [ ] All 16 pages gated via `requirePermission(resource, action, orgSlug)`, redirect `/${orgSlug}` on failure.
- [ ] Zero `requireRole([...])` in `app/(dashboard)/**/page.tsx`.
- [ ] Existing suite green.
- [ ] New per-page RBAC tests cover forbidden-role redirect + authorized render.
- [ ] `tsc --noEmit` clean; no new `any`.
- [ ] `grep "requireRole(" app/(dashboard)` returns zero page-level matches.
