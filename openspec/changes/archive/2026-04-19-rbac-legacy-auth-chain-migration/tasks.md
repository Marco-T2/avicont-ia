# Tasks: rbac-legacy-auth-chain-migration

**Change**: `rbac-legacy-auth-chain-migration`
**Date**: 2026-04-19
**Status**: READY
**Artifact Store**: hybrid (engram + filesystem)
**Prior**: proposal #768, spec #772, design (filesystem)
**Strict TDD Mode**: ACTIVE — RED (test fails because page still uses legacy chain) → GREEN (migrate page) enforced for all 20 migrating pages.

---

## A. Summary

| Batch | Focus | Tasks | Pages |
|-------|-------|-------|-------|
| B1 — Sales cluster | 4 sales pages → `sales:write` | 8 | dispatches/new, dispatches/[dispatchId], sales/new, sales/[saleId] |
| B2 — Purchases + Payments | 4 purchase/payment pages | 8 | purchases/new, purchases/[purchaseId], payments/new, payments/[paymentId] |
| B3 — Accounting reads | 5 accounting read pages | 10 | accounts, balances, correlation-audit, reports, contacts/[contactId] |
| B4 — Journal (incl. DCSN-007) | 3 journal pages, mock swap | 8 | journal/new, journal/[entryId], journal/[entryId]/edit |
| B5 — Settings + Tier B markers | 4 settings pages + 4 RBAC-EXCEPTION markers | 12 | settings×4 + farms, farms/[farmId], lots/[lotId], accounting/ |
| F1 — Finalization | Full regression suite | 5 | (validation only) |
| **TOTAL** | | **51** | |

---

## Canonical patterns (reference — do not implement here)

**Test scaffold** (DCSN-005, `page-rbac.test.ts`):
```ts
const { mockRedirect, mockRequirePermission } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockRequirePermission: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));
vi.mock("@/features/shared/permissions.server", () => ({ requirePermission: mockRequirePermission }));
```
2 assertions: (1) authorized → `mockRequirePermission` called with `(resource, action, orgSlug)`, `mockRedirect` NOT called; (2) forbidden → `mockRedirect` called with `"/${orgSlug}"`.

**Page migration** (DCSN-002/003/009 — long-form mandatory):
```ts
let orgId: string;
try {
  const result = await requirePermission("<resource>", "<action>", orgSlug);
  orgId = result.orgId;
} catch {
  redirect(`/${orgSlug}`);
}
```
Remove `requireAuth`, `requireOrgAccess` imports. Preserve all downstream domain-fetch try/catch blocks (DCSN-010).

---

## B1 — Sales cluster (`sales:write` ×4)

> All 4 pages render write forms (new sale, edit sale, new dispatch, edit dispatch). resource = `sales`, action = `write` for all.

### B1.1-R — RED: `dispatches/new/page.tsx`

**REQ**: REQ-PG.11, REQ-PG.14
**Files**: CREATE `app/(dashboard)/[orgSlug]/dispatches/new/__tests__/page-rbac.test.ts`

Write failing test per DCSN-005. Assert `mockRequirePermission` called with `("sales", "write", "acme")`. Mock dispatch-form client component and any service imports to allow module loading. **Test MUST fail** because page still calls `requireAuth + requireOrgAccess` legacy chain — `mockRequirePermission` never fires.

---

### B1.1-G — GREEN: `dispatches/new/page.tsx`

**REQ**: REQ-PG.1, REQ-PG.2, REQ-PG.7, REQ-PG.10, REQ-PG.14
**Files**: MODIFY `app/(dashboard)/[orgSlug]/dispatches/new/page.tsx`

Replace legacy double try/catch with long-form `requirePermission("sales", "write", orgSlug)`. Assign `orgId = result.orgId`. Remove `requireAuth`/`requireOrgAccess` imports. Preserve downstream service calls using `orgId`. B1.1-R test must pass. `tsc --noEmit` clean on this file.

---

### B1.2-R — RED: `dispatches/[dispatchId]/page.tsx`

**REQ**: REQ-PG.11, REQ-PG.14
**Files**: CREATE `app/(dashboard)/[orgSlug]/dispatches/[dispatchId]/__tests__/page-rbac.test.ts`

Write failing test. Assert `mockRequirePermission` called with `("sales", "write", "acme")`. Mock dispatch detail client component and dispatch service. **Test fails** because page uses legacy chain.

---

### B1.2-G — GREEN: `dispatches/[dispatchId]/page.tsx`

**REQ**: REQ-PG.1, REQ-PG.2, REQ-PG.7, REQ-PG.10, REQ-PG.14
**Files**: MODIFY `app/(dashboard)/[orgSlug]/dispatches/[dispatchId]/page.tsx`

Replace legacy chain with `requirePermission("sales", "write", orgSlug)`. Extract `orgId`. Remove orphan imports. Preserve entity-not-found redirect (DCSN-010). B1.2-R passes. tsc clean.

---

### B1.3-R — RED: `sales/new/page.tsx`

**REQ**: REQ-PG.11, REQ-PG.14
**Files**: CREATE `app/(dashboard)/[orgSlug]/sales/new/__tests__/page-rbac.test.ts`

Write failing test. Assert `mockRequirePermission` called with `("sales", "write", "acme")`. Mock sale-form client component and any service imports. **Test fails** because page uses legacy chain.

---

### B1.3-G — GREEN: `sales/new/page.tsx`

**REQ**: REQ-PG.1, REQ-PG.2, REQ-PG.7, REQ-PG.10, REQ-PG.14
**Files**: MODIFY `app/(dashboard)/[orgSlug]/sales/new/page.tsx`

Replace legacy chain with `requirePermission("sales", "write", orgSlug)`. Extract `orgId`. Remove orphan imports. B1.3-R passes. tsc clean.

---

### B1.4-R — RED: `sales/[saleId]/page.tsx`

**REQ**: REQ-PG.11, REQ-PG.14
**Files**: CREATE `app/(dashboard)/[orgSlug]/sales/[saleId]/__tests__/page-rbac.test.ts`

Write failing test. Assert `mockRequirePermission` called with `("sales", "write", "acme")`. Mock sale detail client component and sale service. **Test fails** because page uses legacy chain.

---

### B1.4-G — GREEN: `sales/[saleId]/page.tsx`

**REQ**: REQ-PG.1, REQ-PG.2, REQ-PG.7, REQ-PG.10, REQ-PG.14
**Files**: MODIFY `app/(dashboard)/[orgSlug]/sales/[saleId]/page.tsx`

Replace legacy chain with `requirePermission("sales", "write", orgSlug)`. Extract `orgId`. Remove orphan imports. Preserve entity redirect (DCSN-010). B1.4-R passes. tsc clean.

---

## B2 — Purchases + Payments cluster

> purchases pages → `purchases:write`. payments pages → `payments:write`.

### B2.1-R — RED: `purchases/new/page.tsx`

**REQ**: REQ-PG.11, REQ-PG.14
**Files**: CREATE `app/(dashboard)/[orgSlug]/purchases/new/__tests__/page-rbac.test.ts`

Write failing test. Assert `mockRequirePermission` called with `("purchases", "write", "acme")`. Mock purchase-form client component and service. **Test fails** because page uses legacy chain.

---

### B2.1-G — GREEN: `purchases/new/page.tsx`

**REQ**: REQ-PG.1, REQ-PG.2, REQ-PG.7, REQ-PG.10, REQ-PG.14
**Files**: MODIFY `app/(dashboard)/[orgSlug]/purchases/new/page.tsx`

Replace legacy chain with `requirePermission("purchases", "write", orgSlug)`. Extract `orgId`. Remove orphan imports. B2.1-R passes. tsc clean.

---

### B2.2-R — RED: `purchases/[purchaseId]/page.tsx`

**REQ**: REQ-PG.11, REQ-PG.14
**Files**: CREATE `app/(dashboard)/[orgSlug]/purchases/[purchaseId]/__tests__/page-rbac.test.ts`

Write failing test. Assert `mockRequirePermission` called with `("purchases", "write", "acme")`. Mock purchase detail client component and purchase service. **Test fails** because page uses legacy chain.

---

### B2.2-G — GREEN: `purchases/[purchaseId]/page.tsx`

**REQ**: REQ-PG.1, REQ-PG.2, REQ-PG.7, REQ-PG.10, REQ-PG.14
**Files**: MODIFY `app/(dashboard)/[orgSlug]/purchases/[purchaseId]/page.tsx`

Replace legacy chain with `requirePermission("purchases", "write", orgSlug)`. Extract `orgId`. Preserve entity redirect (DCSN-010). B2.2-R passes. tsc clean.

---

### B2.3-R — RED: `payments/new/page.tsx`

**REQ**: REQ-PG.11, REQ-PG.14
**Files**: CREATE `app/(dashboard)/[orgSlug]/payments/new/__tests__/page-rbac.test.ts`

Write failing test. Assert `mockRequirePermission` called with `("payments", "write", "acme")`. Mock payment-form client component and service. **Test fails** because page uses legacy chain.

---

### B2.3-G — GREEN: `payments/new/page.tsx`

**REQ**: REQ-PG.1, REQ-PG.2, REQ-PG.7, REQ-PG.10, REQ-PG.14
**Files**: MODIFY `app/(dashboard)/[orgSlug]/payments/new/page.tsx`

Replace legacy chain with `requirePermission("payments", "write", orgSlug)`. Extract `orgId`. Remove orphan imports. B2.3-R passes. tsc clean.

---

### B2.4-R — RED: `payments/[paymentId]/page.tsx`

**REQ**: REQ-PG.11, REQ-PG.14
**Files**: CREATE `app/(dashboard)/[orgSlug]/payments/[paymentId]/__tests__/page-rbac.test.ts`

Write failing test. Assert `mockRequirePermission` called with `("payments", "write", "acme")`. Mock payment detail client component and payment service. **Test fails** because page uses legacy chain.

---

### B2.4-G — GREEN: `payments/[paymentId]/page.tsx`

**REQ**: REQ-PG.1, REQ-PG.2, REQ-PG.7, REQ-PG.10, REQ-PG.14
**Files**: MODIFY `app/(dashboard)/[orgSlug]/payments/[paymentId]/page.tsx`

Replace legacy chain with `requirePermission("payments", "write", orgSlug)`. Extract `orgId`. Preserve entity redirect (DCSN-010). B2.4-R passes. tsc clean.

---

## B3 — Accounting reads (5 pages)

> `accounting/accounts` → `accounting-config:read`. `accounting/balances`, `accounting/correlation-audit`, `accounting/journal/[entryId]` → `journal:read`. `accounting/reports` → `reports:read`. `accounting/contacts/[contactId]` → `contacts:read`.

### B3.1-R — RED: `accounting/accounts/page.tsx`

**REQ**: REQ-PG.11, REQ-PG.14
**Files**: CREATE `app/(dashboard)/[orgSlug]/accounting/accounts/__tests__/page-rbac.test.ts`

Write failing test. Assert `mockRequirePermission` called with `("accounting-config", "read", "acme")`. Mock accounts list client component and accounts service. **Test fails** because page uses legacy chain.

---

### B3.1-G — GREEN: `accounting/accounts/page.tsx`

**REQ**: REQ-PG.1, REQ-PG.2, REQ-PG.7, REQ-PG.10, REQ-PG.14
**Files**: MODIFY `app/(dashboard)/[orgSlug]/accounting/accounts/page.tsx`

Replace legacy chain with `requirePermission("accounting-config", "read", orgSlug)`. Extract `orgId`. Remove orphan imports. B3.1-R passes. tsc clean.

---

### B3.2-R — RED: `accounting/balances/page.tsx`

**REQ**: REQ-PG.11, REQ-PG.14
**Files**: CREATE `app/(dashboard)/[orgSlug]/accounting/balances/__tests__/page-rbac.test.ts`

Write failing test. Assert `mockRequirePermission` called with `("journal", "read", "acme")`. Mock balances client component and balances service. **Test fails** because page uses legacy chain.

---

### B3.2-G — GREEN: `accounting/balances/page.tsx`

**REQ**: REQ-PG.1, REQ-PG.2, REQ-PG.7, REQ-PG.10, REQ-PG.14
**Files**: MODIFY `app/(dashboard)/[orgSlug]/accounting/balances/page.tsx`

Replace legacy chain with `requirePermission("journal", "read", orgSlug)`. Extract `orgId`. Remove orphan imports. B3.2-R passes. tsc clean.

---

### B3.3-R — RED: `accounting/correlation-audit/page.tsx`

**REQ**: REQ-PG.11, REQ-PG.14
**Files**: CREATE `app/(dashboard)/[orgSlug]/accounting/correlation-audit/__tests__/page-rbac.test.ts`

Write failing test. Assert `mockRequirePermission` called with `("journal", "read", "acme")`. Mock correlation-audit client component and audit service. **Test fails** because page uses legacy chain.

---

### B3.3-G — GREEN: `accounting/correlation-audit/page.tsx`

**REQ**: REQ-PG.1, REQ-PG.2, REQ-PG.7, REQ-PG.10, REQ-PG.14
**Files**: MODIFY `app/(dashboard)/[orgSlug]/accounting/correlation-audit/page.tsx`

Replace legacy chain with `requirePermission("journal", "read", orgSlug)`. Extract `orgId`. Remove orphan imports. B3.3-R passes. tsc clean.

---

### B3.4-R — RED: `accounting/reports/page.tsx`

**REQ**: REQ-PG.11, REQ-PG.14
**Files**: CREATE `app/(dashboard)/[orgSlug]/accounting/reports/__tests__/page-rbac.test.ts`

Write failing test. Assert `mockRequirePermission` called with `("reports", "read", "acme")`. Mock reports client component and reports service. **Test fails** because page uses legacy chain.

---

### B3.4-G — GREEN: `accounting/reports/page.tsx`

**REQ**: REQ-PG.1, REQ-PG.2, REQ-PG.7, REQ-PG.10, REQ-PG.14
**Files**: MODIFY `app/(dashboard)/[orgSlug]/accounting/reports/page.tsx`

Replace legacy chain with `requirePermission("reports", "read", orgSlug)`. Extract `orgId`. Remove orphan imports. B3.4-R passes. tsc clean.

---

### B3.5-R — RED: `accounting/contacts/[contactId]/page.tsx`

**REQ**: REQ-PG.11, REQ-PG.14
**Files**: CREATE `app/(dashboard)/[orgSlug]/accounting/contacts/[contactId]/__tests__/page-rbac.test.ts`

Write failing test. Assert `mockRequirePermission` called with `("contacts", "read", "acme")`. Mock contact detail client component and contacts service. **Test fails** because page uses legacy chain.

---

### B3.5-G — GREEN: `accounting/contacts/[contactId]/page.tsx`

**REQ**: REQ-PG.1, REQ-PG.2, REQ-PG.7, REQ-PG.10, REQ-PG.14
**Files**: MODIFY `app/(dashboard)/[orgSlug]/accounting/contacts/[contactId]/page.tsx`

Replace legacy chain with `requirePermission("contacts", "read", orgSlug)`. Extract `orgId`. Preserve entity notFound() (DCSN-010). Remove orphan imports. B3.5-R passes. tsc clean.

---

## B4 — Journal cluster (DCSN-007 applies to [entryId]/edit)

### B4.1-R — RED: `accounting/journal/new/page.tsx`

**REQ**: REQ-PG.11, REQ-PG.14
**Files**: CREATE `app/(dashboard)/[orgSlug]/accounting/journal/new/__tests__/page-rbac.test.ts`

Write failing test. Assert `mockRequirePermission` called with `("journal", "write", "acme")`. Mock journal-new form client component and account/period service stubs. **Test fails** because page uses legacy chain.

---

### B4.1-G — GREEN: `accounting/journal/new/page.tsx`

**REQ**: REQ-PG.1, REQ-PG.2, REQ-PG.7, REQ-PG.10, REQ-PG.14
**Files**: MODIFY `app/(dashboard)/[orgSlug]/accounting/journal/new/page.tsx`

Replace legacy chain with `requirePermission("journal", "write", orgSlug)`. Extract `orgId`. Remove orphan imports. B4.1-R passes. tsc clean.

---

### B4.2-R — RED: `accounting/journal/[entryId]/page.tsx`

**REQ**: REQ-PG.11, REQ-PG.14
**Files**: CREATE `app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/__tests__/page-rbac.test.ts`

Write failing test. Assert `mockRequirePermission` called with `("journal", "read", "acme")`. Mock journal detail client component and journal service. **Test fails** because page uses legacy chain.

---

### B4.2-G — GREEN: `accounting/journal/[entryId]/page.tsx`

**REQ**: REQ-PG.1, REQ-PG.2, REQ-PG.7, REQ-PG.10, REQ-PG.14
**Files**: MODIFY `app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/page.tsx`

Replace legacy chain with `requirePermission("journal", "read", orgSlug)`. Extract `orgId`. Preserve entity notFound() (DCSN-010). Remove orphan imports. B4.2-R passes. tsc clean.

---

### B4.3-MS — MOCK-SWAP: `accounting/journal/[entryId]/edit/__tests__/page.test.ts` (DCSN-007)

**REQ**: REQ-PG.14, T3.1–T7.9 preserved
**Files**: MODIFY `app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/edit/__tests__/page.test.ts`

**SPECIAL** — this is the ONLY existing test file that mocks the legacy auth chain.

Swap the mock block (lines 32–35 approximately):
```ts
// REMOVE:
vi.mock("@/features/shared", () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "clerk-user-1" }),
  requireOrgAccess: vi.fn().mockResolvedValue("org-db-id"),
}));

// ADD:
vi.mock("@/features/shared/permissions.server", () => ({
  requirePermission: vi
    .fn()
    .mockResolvedValue({ orgId: "org-db-id", session: { userId: "clerk-user-1" }, role: "owner" }),
}));
```
T3.1–T7.9 assertion bodies stay byte-for-byte identical. Verify all T3.x tests still pass after swap (mock resolves = authorized path, domain-guard branches exercise identically).

---

### B4.3-R — RED: `accounting/journal/[entryId]/edit/__tests__/page-rbac.test.ts` (DCSN-007 sibling)

**REQ**: REQ-PG.11, REQ-PG.14
**Files**: CREATE `app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/edit/__tests__/page-rbac.test.ts`

Write NEW failing RBAC test (separate from page.test.ts per DCSN-007). Assert `mockRequirePermission` called with `("journal", "write", "acme")`. Mock same stubs as page.test.ts. **Test fails** because page still uses legacy chain at this point (B4.3-MS has run but page code not yet migrated).

> Note: B4.3-MS must complete before this task. The mock-swap in page.test.ts does NOT make the page code canonical — that happens in B4.3-G.

---

### B4.3-G — GREEN: `accounting/journal/[entryId]/edit/page.tsx` (same commit as B4.3-MS)

**REQ**: REQ-PG.1, REQ-PG.2, REQ-PG.7, REQ-PG.10, REQ-PG.14
**Files**: MODIFY `app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/edit/page.tsx`

Replace legacy chain with `requirePermission("journal", "write", orgSlug)`. Extract `orgId`. Remove orphan `requireAuth`/`requireOrgAccess` imports. Preserve T3-series domain-guard branches (DCSN-010): period-closed redirect, entry notFound, DRAFT/POSTED/VOIDED guards — all untouched.

**Commit atomically with B4.3-MS** (same commit = mock swap + page migration). B4.3-R (page-rbac.test.ts) must pass. T3.1–T7.9 in page.test.ts must still pass. tsc clean.

---

## B5 — Settings (Tier C) + Tier B RBAC-EXCEPTION markers

### B5.1-R — RED: `settings/periods/page.tsx`

**REQ**: REQ-PG.11, REQ-PG.14
**Files**: CREATE `app/(dashboard)/[orgSlug]/settings/periods/__tests__/page-rbac.test.ts`

Write failing test. Assert `mockRequirePermission` called with `("accounting-config", "write", "acme")`. Mock periods list client component and periods service. **Test fails** because page uses legacy chain.

---

### B5.1-G — GREEN: `settings/periods/page.tsx`

**REQ**: REQ-PG.1, REQ-PG.2, REQ-PG.7, REQ-PG.10, REQ-PG.14
**Files**: MODIFY `app/(dashboard)/[orgSlug]/settings/periods/page.tsx`

Replace legacy chain with `requirePermission("accounting-config", "write", orgSlug)`. Extract `orgId`. Remove orphan imports. B5.1-R passes. tsc clean.

---

### B5.2-R — RED: `settings/voucher-types/page.tsx`

**REQ**: REQ-PG.11, REQ-PG.14
**Files**: CREATE `app/(dashboard)/[orgSlug]/settings/voucher-types/__tests__/page-rbac.test.ts`

Write failing test. Assert `mockRequirePermission` called with `("accounting-config", "write", "acme")`. Mock voucher-types client component and service. **Test fails** because page uses legacy chain.

---

### B5.2-G — GREEN: `settings/voucher-types/page.tsx`

**REQ**: REQ-PG.1, REQ-PG.2, REQ-PG.7, REQ-PG.10, REQ-PG.14
**Files**: MODIFY `app/(dashboard)/[orgSlug]/settings/voucher-types/page.tsx`

Replace legacy chain with `requirePermission("accounting-config", "write", orgSlug)`. Extract `orgId`. Remove orphan imports. B5.2-R passes. tsc clean.

---

### B5.3-R — RED: `settings/operational-doc-types/page.tsx`

**REQ**: REQ-PG.11, REQ-PG.14
**Files**: CREATE `app/(dashboard)/[orgSlug]/settings/operational-doc-types/__tests__/page-rbac.test.ts`

Write failing test. Assert `mockRequirePermission` called with `("accounting-config", "write", "acme")`. Mock operational-doc-types client component and service. **Test fails** because page uses legacy chain.

---

### B5.3-G — GREEN: `settings/operational-doc-types/page.tsx`

**REQ**: REQ-PG.1, REQ-PG.2, REQ-PG.7, REQ-PG.10, REQ-PG.14
**Files**: MODIFY `app/(dashboard)/[orgSlug]/settings/operational-doc-types/page.tsx`

Replace legacy chain with `requirePermission("accounting-config", "write", orgSlug)`. Extract `orgId`. Remove orphan imports. B5.3-R passes. tsc clean.

---

### B5.4-R — RED: `settings/product-types/page.tsx`

**REQ**: REQ-PG.11, REQ-PG.14
**Files**: CREATE `app/(dashboard)/[orgSlug]/settings/product-types/__tests__/page-rbac.test.ts`

Write failing test. Assert `mockRequirePermission` called with `("accounting-config", "write", "acme")`. Mock product-types client component and service. **Test fails** because page uses legacy chain.

---

### B5.4-G — GREEN: `settings/product-types/page.tsx`

**REQ**: REQ-PG.1, REQ-PG.2, REQ-PG.7, REQ-PG.10, REQ-PG.14
**Files**: MODIFY `app/(dashboard)/[orgSlug]/settings/product-types/page.tsx`

Replace legacy chain with `requirePermission("accounting-config", "write", orgSlug)`. Extract `orgId`. Remove orphan imports. B5.4-R passes. tsc clean.

---

### B5.5 — MARKER: `farms/page.tsx` (Tier B RBAC-EXCEPTION)

**REQ**: REQ-PG.15
**Files**: MODIFY `app/(dashboard)/[orgSlug]/farms/page.tsx`

Insert immediately above the first `try {` containing `requireAuth()`:
```ts
// RBAC-EXCEPTION: Cross-module auth-only; no farms resource in frozen Resource union. Decision: rbac-legacy-auth-chain-migration 2026-04-19.
```
Do NOT remove the legacy chain. Do NOT add `requirePermission`. Confirm `canAccess` usage (if present) is preserved unchanged.

---

### B5.6 — MARKER: `farms/[farmId]/page.tsx` (Tier B RBAC-EXCEPTION)

**REQ**: REQ-PG.15
**Files**: MODIFY `app/(dashboard)/[orgSlug]/farms/[farmId]/page.tsx`

Insert immediately above the first `try {` containing `requireAuth()`:
```ts
// RBAC-EXCEPTION: Cross-module auth-only; no farms resource in frozen Resource union. Decision: rbac-legacy-auth-chain-migration 2026-04-19.
```
Do NOT remove the legacy chain. Preserve all downstream page logic.

---

### B5.7 — MARKER: `lots/[lotId]/page.tsx` (Tier B RBAC-EXCEPTION)

**REQ**: REQ-PG.15
**Files**: MODIFY `app/(dashboard)/[orgSlug]/lots/[lotId]/page.tsx`

Insert immediately above the first `try {` containing `requireAuth()`:
```ts
// RBAC-EXCEPTION: Cross-module auth-only; no lots resource in frozen Resource union. Decision: rbac-legacy-auth-chain-migration 2026-04-19.
```
Do NOT remove the legacy chain. Preserve all downstream page logic.

---

### B5.8 — MARKER: `accounting/page.tsx` (Tier B RBAC-EXCEPTION)

**REQ**: REQ-PG.15
**Files**: MODIFY `app/(dashboard)/[orgSlug]/accounting/page.tsx`

Insert immediately above the first `try {` containing `requireAuth()`:
```ts
// RBAC-EXCEPTION: Dashboard hub with summary cards only; sub-sections each gated. Hub gate redundant. Decision: rbac-legacy-auth-chain-migration 2026-04-19.
```
Do NOT remove the legacy chain. Preserve all downstream page logic.

---

## F1 — Finalization (regression suite)

### F1.1 — Full Vitest suite

Run `npx vitest run`. All tests must pass (0 failures). Confirm all 20 new `page-rbac.test.ts` files are included. Confirm T3.1–T7.9 in `journal/[entryId]/edit/__tests__/page.test.ts` still pass.

---

### F1.2 — TypeScript check

Run `npx tsc --noEmit`. Must exit 0. Zero type errors across all 24 modified pages and 20 new/modified test files.

---

### F1.3 — Grep Gate 1: legacy chain in EXACTLY 4 files

```bash
grep -rlE "requireAuth\(|requireOrgAccess\(" "app/(dashboard)/[orgSlug]"/**/page.tsx | wc -l
```
Expected output: `4`. The 4 files: `farms/page.tsx`, `farms/[farmId]/page.tsx`, `lots/[lotId]/page.tsx`, `accounting/page.tsx`. Any other count is a BLOCKER.

---

### F1.4 — Grep Gate 2: every Tier B file has RBAC-EXCEPTION marker

```bash
for f in $(grep -rlE "requireAuth\(" "app/(dashboard)/[orgSlug]"/**/page.tsx); do
  grep -q "RBAC-EXCEPTION:" "$f" || echo "MISSING MARKER: $f"
done
```
Expected: no output. Any `MISSING MARKER:` line is a BLOCKER.

---

### F1.5 — Grep Gate 3: zero `requireRole` regressions

```bash
grep -rE "requireRole\(" "app/(dashboard)"/**/page.tsx
```
Expected: no output. Any match is a BLOCKER (REQ-PG.8 violation).

---

## Resource:Action mapping (complete — REQ-PG.14)

| Task pair | Page path | resource | action |
|-----------|-----------|----------|--------|
| B1.1 | dispatches/new/page.tsx | sales | write |
| B1.2 | dispatches/[dispatchId]/page.tsx | sales | write |
| B1.3 | sales/new/page.tsx | sales | write |
| B1.4 | sales/[saleId]/page.tsx | sales | write |
| B2.1 | purchases/new/page.tsx | purchases | write |
| B2.2 | purchases/[purchaseId]/page.tsx | purchases | write |
| B2.3 | payments/new/page.tsx | payments | write |
| B2.4 | payments/[paymentId]/page.tsx | payments | write |
| B3.1 | accounting/accounts/page.tsx | accounting-config | read |
| B3.2 | accounting/balances/page.tsx | journal | read |
| B3.3 | accounting/correlation-audit/page.tsx | journal | read |
| B3.4 | accounting/reports/page.tsx | reports | read |
| B3.5 | accounting/contacts/[contactId]/page.tsx | contacts | read |
| B4.1 | accounting/journal/new/page.tsx | journal | write |
| B4.2 | accounting/journal/[entryId]/page.tsx | journal | read |
| B4.3 | accounting/journal/[entryId]/edit/page.tsx | journal | write |
| B5.1 | settings/periods/page.tsx | accounting-config | write |
| B5.2 | settings/voucher-types/page.tsx | accounting-config | write |
| B5.3 | settings/operational-doc-types/page.tsx | accounting-config | write |
| B5.4 | settings/product-types/page.tsx | accounting-config | write |

---

## Checklist

### B1 — Sales cluster
- [x] B1.1-R RED: `dispatches/new/__tests__/page-rbac.test.ts` created, fails
- [x] B1.1-G GREEN: `dispatches/new/page.tsx` migrated, test passes
- [x] B1.2-R RED: `dispatches/[dispatchId]/__tests__/page-rbac.test.ts` created, fails
- [x] B1.2-G GREEN: `dispatches/[dispatchId]/page.tsx` migrated, test passes
- [x] B1.3-R RED: `sales/new/__tests__/page-rbac.test.ts` created, fails
- [x] B1.3-G GREEN: `sales/new/page.tsx` migrated, test passes
- [x] B1.4-R RED: `sales/[saleId]/__tests__/page-rbac.test.ts` created, fails
- [x] B1.4-G GREEN: `sales/[saleId]/page.tsx` migrated, test passes

### B2 — Purchases + Payments
- [x] B2.1-R RED: `purchases/new/__tests__/page-rbac.test.ts` created, fails
- [x] B2.1-G GREEN: `purchases/new/page.tsx` migrated, test passes
- [x] B2.2-R RED: `purchases/[purchaseId]/__tests__/page-rbac.test.ts` created, fails
- [x] B2.2-G GREEN: `purchases/[purchaseId]/page.tsx` migrated, test passes
- [x] B2.3-R RED: `payments/new/__tests__/page-rbac.test.ts` created, fails
- [x] B2.3-G GREEN: `payments/new/page.tsx` migrated, test passes
- [x] B2.4-R RED: `payments/[paymentId]/__tests__/page-rbac.test.ts` created, fails
- [x] B2.4-G GREEN: `payments/[paymentId]/page.tsx` migrated, test passes

### B3 — Accounting reads
- [x] B3.1-R RED: `accounting/accounts/__tests__/page-rbac.test.ts` created, fails
- [x] B3.1-G GREEN: `accounting/accounts/page.tsx` migrated, test passes
- [x] B3.2-R RED: `accounting/balances/__tests__/page-rbac.test.ts` created, fails
- [x] B3.2-G GREEN: `accounting/balances/page.tsx` migrated, test passes
- [x] B3.3-R RED: `accounting/correlation-audit/__tests__/page-rbac.test.ts` created, fails
- [x] B3.3-G GREEN: `accounting/correlation-audit/page.tsx` migrated, test passes
- [x] B3.4-R RED: `accounting/reports/__tests__/page-rbac.test.ts` created, fails
- [x] B3.4-G GREEN: `accounting/reports/page.tsx` migrated, test passes
- [x] B3.5-R RED: `accounting/contacts/[contactId]/__tests__/page-rbac.test.ts` created, fails
- [x] B3.5-G GREEN: `accounting/contacts/[contactId]/page.tsx` migrated, test passes

### B4 — Journal (DCSN-007)
- [x] B4.1-R RED: `accounting/journal/new/__tests__/page-rbac.test.ts` created, fails
- [x] B4.1-G GREEN: `accounting/journal/new/page.tsx` migrated, test passes
- [x] B4.2-R RED: `accounting/journal/[entryId]/__tests__/page-rbac.test.ts` created, fails
- [x] B4.2-G GREEN: `accounting/journal/[entryId]/page.tsx` migrated, test passes
- [x] B4.3-MS MOCK-SWAP: `edit/__tests__/page.test.ts` mock block swapped, T3.1–T7.9 still green
- [x] B4.3-R RED: `edit/__tests__/page-rbac.test.ts` created, fails (page not yet migrated)
- [x] B4.3-G GREEN: `edit/page.tsx` migrated (same commit as B4.3-MS), page-rbac.test.ts passes, T3.* still green

### B5 — Settings + Tier B markers
- [x] B5.1-R RED: `settings/periods/__tests__/page-rbac.test.ts` created, fails
- [x] B5.1-G GREEN: `settings/periods/page.tsx` migrated, test passes
- [x] B5.2-R RED: `settings/voucher-types/__tests__/page-rbac.test.ts` created, fails
- [x] B5.2-G GREEN: `settings/voucher-types/page.tsx` migrated, test passes
- [x] B5.3-R RED: `settings/operational-doc-types/__tests__/page-rbac.test.ts` created, fails
- [x] B5.3-G GREEN: `settings/operational-doc-types/page.tsx` migrated, test passes
- [x] B5.4-R RED: `settings/product-types/__tests__/page-rbac.test.ts` created, fails
- [x] B5.4-G GREEN: `settings/product-types/page.tsx` migrated, test passes
- [x] B5.5 MARKER: `farms/page.tsx` RBAC-EXCEPTION inserted
- [x] B5.6 MARKER: `farms/[farmId]/page.tsx` RBAC-EXCEPTION inserted
- [x] B5.7 MARKER: `lots/[lotId]/page.tsx` RBAC-EXCEPTION inserted
- [x] B5.8 MARKER: `accounting/page.tsx` RBAC-EXCEPTION inserted

### F1 — Finalization
- [ ] F1.1 Vitest suite — 100% green, T3.1–T7.9 confirmed
- [ ] F1.2 tsc --noEmit — exit 0
- [ ] F1.3 Grep Gate 1 — legacy chain in EXACTLY 4 files
- [ ] F1.4 Grep Gate 2 — all 4 Tier B files have RBAC-EXCEPTION marker
- [ ] F1.5 Grep Gate 3 — zero requireRole in page.tsx files

---

## Return Envelope

- **status**: COMPLETE
- **executive_summary**: 51 tasks across 5 resource-coherent batches + 5 finalization checks. All 20 migrating pages have explicit RED→GREEN pairs enforcing Strict TDD. B4 includes the DCSN-007 special handling: mock-swap task (B4.3-MS) + sibling page-rbac.test.ts (B4.3-R/G) with same-commit atomicity constraint. B5 covers 4 Tier C settings pages (pairs) + 4 Tier B RBAC-EXCEPTION marker-only tasks. F1.3–F1.5 are the 3 grep gates from DCSN-008.
- **artifacts**: `openspec/changes/rbac-legacy-auth-chain-migration/tasks.md` + engram `sdd/rbac-legacy-auth-chain-migration/tasks`
- **next_recommended**: `sdd-apply` (start with B1)
- **skill_resolution**: injected
