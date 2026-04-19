# Proposal: RBAC Legacy Auth-Chain Migration

**Date**: 2026-04-19 | **Status**: DRAFT | **Store**: hybrid
**Prior**: explore #767, rbac-page-gating-fix archive #765 (DCSN-002/003/005)

## Intent

Close custom-roles matrix bypass on 20 dashboard pages still on legacy `requireAuth + requireOrgAccess`. Any authenticated org member (incl. custom roles with zero perms) can direct-URL them. Migrate to canonical `requirePermission(resource, action, orgSlug)` frozen by rbac-page-gating-fix.

## Scope — In (20 pages)

Under `app/(dashboard)/[orgSlug]/`. Pattern per DCSN-002/003.

**Tier A — 16 module sub-pages**

| Page | resource:action |
|---|---|
| `dispatches/new` | `sales:write` |
| `dispatches/[dispatchId]` | `sales:read` |
| `sales/new` | `sales:write` |
| `sales/[saleId]` | `sales:read` |
| `purchases/new` | `purchases:write` |
| `purchases/[purchaseId]` | `purchases:read` |
| `payments/new` | `payments:write` |
| `payments/[paymentId]` | `payments:read` |
| `accounting/accounts` | `accounting-config:read` |
| `accounting/balances` | `journal:read` |
| `accounting/correlation-audit` | `journal:read` |
| `accounting/reports` | `reports:read` |
| `accounting/journal/new` | `journal:write` |
| `accounting/journal/[entryId]` | `journal:read` |
| `accounting/journal/[entryId]/edit` | `journal:write` |
| `accounting/contacts/[contactId]` | `contacts:read` |

**Tier C — 4 settings sub-pages, all `accounting-config:write`**: `settings/periods`, `settings/voucher-types`, `settings/operational-doc-types`, `settings/product-types`.

Tests: per-page `__tests__/page.test.ts` per DCSN-005. `journal/[entryId]/edit` REWRITE preserves T3.1–T7.9 (DRAFT/POSTED/VOIDED/period-gate) — swap only auth mocks.

## Scope — Out

**Tier B — 4 intentional auth-only, NOT migrated**:
- `farms/page.tsx`, `farms/[farmId]/page.tsx`, `lots/[lotId]/page.tsx` — cross-module `canAccess` capability-discovery (explore #758); no resource in frozen union maps to farms/lots.
- `accounting/page.tsx` — hub landing; sub-sections already gated by rbac-page-gating-fix. Hub-level gate = redundant (user intent: "cards de resumen" dashboard).

Also out: no new RBAC abstractions; no `proxy.ts`; no `Resource` union changes; no `requirePermission` internals; no test-infra changes.

## Capabilities

**New**: None. **Modified**: `rbac-page-gating` — delta adds REQ-PG.14 (mapping for the 20 pages) + REQ-PG.15 (4 Tier B intentional exceptions + code-comment marker). Reformulates capability: "every dashboard page.tsx follows canonical pattern except documented Tier B exceptions."

## Approach

Page-by-page `requirePermission` (DCSN-001). Strict TDD: RED (assert exact `resource, action, orgSlug` call) → GREEN (edit page) → REFACTOR. Apply DCSN-002 (`let orgId: string` + single try/catch), DCSN-003 (`redirect(\`/${orgSlug}\`)`), DCSN-005 (`vi.hoisted`, `.test.ts` node env). 2-PR split: PR1 Tier A reads (additive); PR2 Tier A writes + Tier C + `journal/edit` test rewrite (semantic).

## Risks

| Risk | Sev | Mitigation |
|---|---|---|
| `journal/[entryId]/edit` rewrite drops T3.1–T7.9 coverage | M | Same-commit rewrite; assertion-by-assertion diff; CI gate |
| 6 Tier A pages in concurrent changes (`sales-dispatch-forms-ux`, `purchases-forms-ux`, `manual-journal-ux`) | M | Serialize after merge; OR ship 14 independent first, 6 post-rebase |
| `write` gate on `/new`+`/edit` blocks `read`-only roles | L | Intentional (read ≠ create); confirm UX w/ product before PR2 |
| `accounting-config:write` fit for 4 Tier C | L | Re-verify per-page mutates config; default matrix gives owner/admin/contador |

## Rollback Plan

Single-commit revert per PR. No DB migration, no schema change.

## Dependencies

- rbac-page-gating-fix closed e53b19e (#765) → canonical pattern + spec
- `Resource` union frozen (DCSN-001, resource-nav-mapping-fix #756)
- `requirePermission` stable (custom-roles #715)
- Strict TDD Mode active

## Success Criteria

- [ ] 20 pages migrated per Scope mapping
- [ ] 4 Tier B documented as intentional auth-only (code comment + REQ-PG.15)
- [ ] `grep -E "requireAuth\(|requireOrgAccess\(" app/(dashboard)/[orgSlug]/**/page.tsx` returns ONLY 4 Tier B pages
- [ ] `grep "requireRole(" app/(dashboard)/**/page.tsx` stays at zero (REQ-PG.8 preserved)
- [ ] T3.1–T7.9 preserved; full Vitest suite green; `tsc --noEmit` exit 0
- [ ] 20 new/rewritten test files per DCSN-005
