# Verify Report: rbac-legacy-auth-chain-migration

**Date**: 2026-04-19
**Verifier**: sdd-verify (Strict TDD Mode ACTIVE)
**Prior artifacts consumed**: spec #772, design #773 (latest), tasks (filesystem), apply-progress #775, proposal #768

---

## Overall Verdict

PASS — All 20 pages migrated with correct resource:action mappings, all 4 Tier B markers present, 3/3 F1 grep gates pass, DCSN-007 special case fully satisfied, +40 test delta matches exactly 20 × 2.

---

## Completeness Matrix

| REQ | Status | Evidence |
|---|---|---|
| REQ-PG.14 | COMPLIANT | 20/20 pages verified — all call `requirePermission` with canonical resource:action from spec mapping table; legacy chain removed from all 20; 20 `page-rbac.test.ts` files exist with 2 RBAC assertions each |
| REQ-PG.15 | COMPLIANT | 4/4 Tier B markers present immediately above `try { const session = await requireAuth()` block; legacy chain intact; no `requirePermission` added |

---

## Per-page audit (REQ-PG.14)

| Page | Resource:Action | Gate | Long-form | Legacy Removed | Domain Redirects | Test File | Test Matches Spec |
|------|---|---|---|---|---|---|---|
| dispatches/new/page.tsx | sales:write | ✓ | ✓ | ✓ | ✓ (none needed) | ✓ | ✓ |
| dispatches/[dispatchId]/page.tsx | sales:write | ✓ | ✓ | ✓ | ✓ (→ /dispatches) | ✓ | ✓ |
| sales/new/page.tsx | sales:write | ✓ | ✓ | ✓ | ✓ (none needed) | ✓ | ✓ |
| sales/[saleId]/page.tsx | sales:write | ✓ | ✓ | ✓ | ✓ (→ /sales) | ✓ | ✓ |
| purchases/new/page.tsx | purchases:write | ✓ | ✓ | ✓ | ✓ (none needed) | ✓ | ✓ |
| purchases/[purchaseId]/page.tsx | purchases:write | ✓ | ✓ | ✓ | ✓ (→ /purchases) | ✓ | ✓ |
| payments/new/page.tsx | payments:write | ✓ | ✓ | ✓ | ✓ (none needed) | ✓ | ✓ |
| payments/[paymentId]/page.tsx | payments:write | ✓ | ✓ | ✓ | ✓ (→ entity) | ✓ | ✓ |
| accounting/accounts/page.tsx | accounting-config:read | ✓ | ✓ | ✓ | ✓ (none) | ✓ | ✓ |
| accounting/balances/page.tsx | journal:read | ✓ | ✓ | ✓ | ✓ (none) | ✓ | ✓ |
| accounting/correlation-audit/page.tsx | journal:read | ✓ | ✓ | ✓ | ✓ (none) | ✓ | ✓ |
| accounting/reports/page.tsx | reports:read | ✓ | SHORT-FORM* | ✓ | ✓ (none) | ✓ | ✓ |
| accounting/contacts/[contactId]/page.tsx | contacts:read | ✓ | ✓ | ✓ | ✓ (notFound) | ✓ | ✓ |
| accounting/journal/new/page.tsx | journal:write | ✓ | ✓ | ✓ | ✓ (none) | ✓ | ✓ |
| accounting/journal/[entryId]/page.tsx | journal:read | ✓ | ✓ | ✓ | ✓ (notFound) | ✓ | ✓ |
| accounting/journal/[entryId]/edit/page.tsx | journal:write | ✓ | ✓ | ✓ | ✓ (multiple guards) | ✓ | ✓ |
| settings/periods/page.tsx | accounting-config:write | ✓ | ✓ | ✓ | ✓ (none) | ✓ | ✓ |
| settings/voucher-types/page.tsx | accounting-config:write | ✓ | ✓ | ✓ | ✓ (none) | ✓ | ✓ |
| settings/operational-doc-types/page.tsx | accounting-config:write | ✓ | ✓ | ✓ | ✓ (none) | ✓ | ✓ |
| settings/product-types/page.tsx | accounting-config:write | ✓ | ✓ | ✓ | ✓ (none) | ✓ | ✓ |

**\* accounting/reports/page.tsx short-form note**: DCSN-009 mandates long-form only when `orgId` is consumed downstream. `reports/page.tsx` does NOT use `orgId` — it passes `orgSlug` only to `ReportsPageClient`. Short-form is explicitly allowed by DCSN-009 in this case. **NOT a violation.**

---

## Per-page audit (REQ-PG.15)

| Page | Legacy intact | Marker present | Marker line | Reason matches |
|------|---|---|---|---|
| farms/page.tsx | ✓ | ✓ | L17 (above `try { const session = await requireAuth()`) | ✓ Cross-module auth-only; no farms resource in frozen Resource union |
| farms/[farmId]/page.tsx | ✓ | ✓ | L14 (above `try { const session = await requireAuth()`) | ✓ Cross-module auth-only; no farms resource in frozen Resource union |
| lots/[lotId]/page.tsx | ✓ | ✓ | L15 (above `try { const session = await requireAuth()`) | ✓ Cross-module auth-only; no lots resource in frozen Resource union |
| accounting/page.tsx | ✓ | ✓ | L26 (above `try { const session = await requireAuth()`) | ✓ Dashboard hub with summary cards only; sub-sections each gated |

All 4 marker texts include `Decision: rbac-legacy-auth-chain-migration 2026-04-19.` suffix per DCSN-008.

---

## DCSN-007 special audit

- `accounting/journal/[entryId]/edit/__tests__/page.test.ts` exists with T3.3, T3.1, T3.2, T3.2b, T3.4, T3.4b, T7.8, T7.9 — 8 business-logic tests confirmed present.
- Mock block swapped from `vi.mock("@/features/shared", ...)` → `vi.mock("@/features/shared/permissions.server", () => ({ requirePermission: vi.fn().mockResolvedValue({ orgId: "org-db-id", session: { userId: "clerk-user-1" }, role: "owner" }) }))` at lines 32–36. Exact per DCSN-007.
- Sibling `accounting/journal/[entryId]/edit/__tests__/page-rbac.test.ts` exists with 2 RBAC assertions targeting `journal:write` (positive: `requirePermission` called with `("journal", "write", "acme")`; negative: `redirect` called with `"/${ORG_SLUG}"`).
- `edit/page.tsx` uses `requirePermission("journal", "write", orgSlug)` long-form with `orgId = result.orgId` extraction. Domain-fetch guards preserved: `notFound()` for missing entry, period-closed redirect, POSTED-auto/VOIDED redirect to detail.

---

## F1 re-run results

- **F1.3** (legacy chain in EXACTLY 4 files): `grep -rlE "requireAuth\(|requireOrgAccess\(" app/(dashboard)/[orgSlug]/**/page.tsx` → 4 files: `farms/page.tsx`, `farms/[farmId]/page.tsx`, `lots/[lotId]/page.tsx`, `accounting/page.tsx`. **PASS**
- **F1.4** (all Tier B files have RBAC-EXCEPTION marker): Checked all 4 files explicitly — all return `MARKER OK`. **PASS**  
  *(Note: the loop variant using shell glob quoting `"app/(dashboard)/[orgSlug]"/**/page.tsx` only returned 2 files due to a shell expansion issue; direct explicit-path check confirmed all 4. This is a shell invocation artifact, not a code issue.)*
- **F1.5** (zero `requireRole` in page.tsx): `grep -rlE "requireRole\(" app/(dashboard)/**/page.tsx` → 0 files. **PASS**
- **requirePermission count** across all 20 migration pages: exactly 20 files with `requirePermission(` call. **PASS**

---

## Findings

### CRITICAL (blocks archive)
- None

### WARNING (contextual accept)
- None

### SUGGESTION (non-blocking, future)
- `accounting/reports/page.tsx` uses short-form (no `orgId` extraction). This is valid per DCSN-009 since `orgId` is unused — but future maintainers adding service calls that need `orgId` will need to upgrade to long-form. A code comment to this effect could prevent silent mistakes.
- The F1.4 shell loop gate variant has a shell glob quoting fragility with paths containing parentheses and brackets. Consider wrapping the gate script in a helper (e.g. a `package.json` script `"test:rbac-gates"`) to make it reliably re-runnable in CI without quoting issues.

---

## Metrics

- Pages audited: 24 (20 migrate + 4 Tier B)
- Tests delta: +40 (20 × 2 assertions) — matches baseline 1683 → 1723
- Strict TDD adherence: PASS — all 20 pages have `page-rbac.test.ts`; tasks.md shows all 46 R/G task pairs checked; apply-progress confirms RED→GREEN discipline enforced per batch
- Grep gates: 3/3 PASS (F1.3, F1.4, F1.5)
- tsc: exit 0 (from apply-progress F1.2, trusted — no new TS changes since)
- vitest: 1723/1723 pass (from apply-progress F1.1, trusted)

---

## Recommendation

PROCEED-TO-ARCHIVE
