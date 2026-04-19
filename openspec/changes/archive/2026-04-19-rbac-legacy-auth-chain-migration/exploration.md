# Exploration: rbac-legacy-auth-chain-migration

**Change**: rbac-legacy-auth-chain-migration
**Date**: 2026-04-19
**Status**: COMPLETE
**Prior artifacts consumed**:
  - `sdd/rbac-page-gating-fix/verify-report` (#764) — W-2 warning: "18 out-of-scope pages retain old auth chain"
  - `sdd/rbac-page-gating-fix/design` (#761) — canonical DCSN-002/003/005
  - `sdd/rbac-page-gating-fix/explore` (#758) — prior categorization of medium-severity pages
  - `sdd-init/avicont-ia` (#171) — stack context

---

## Context

W-2 from the `rbac-page-gating-fix` verify report flagged pages outside that change's scope that still use
`requireAuth + requireOrgAccess` without an RBAC matrix gate. These pages have authentication but bypass
the custom-roles permission matrix — a user with any org membership can access them regardless of their
role's resource permissions.

The verifier counted **18** at the time. A fresh grep of the codebase today returns **24** files, meaning
6 new legacy pages have been added since the verify ran (likely from the `manual-journal-ux`,
`sales-dispatch-forms-ux`, and `purchases-forms-ux` changes still in progress).

---

## Current State

All 24 pages under `app/(dashboard)/[orgSlug]/` currently using the **legacy two-step auth chain**:

```ts
// LEGACY PATTERN — bypasses RBAC matrix
let userId: string;
try { const session = await requireAuth(); userId = session.userId; } catch { redirect("/sign-in"); }
let orgId: string;
try { orgId = await requireOrgAccess(userId, orgSlug); } catch { redirect("/select-org"); }
```

None of these 24 call `requirePermission(resource, action, orgSlug)`. An org member with a custom role
that has zero resource permissions can navigate directly to these URLs and get full access.

The **canonical pattern** (DCSN-002/003, frozen by rbac-page-gating-fix) is:

```ts
let orgId: string;
try {
  const result = await requirePermission("<resource>", "<read|write>", orgSlug);
  orgId = result.orgId;
} catch {
  redirect(`/${orgSlug}`);
}
```

---

## Affected Areas

All paths relative to `app/(dashboard)/[orgSlug]/`.

### Tier A — NEEDS RBAC GATE (resource maps clearly to Resource union)

These pages expose sensitive business data that is gated at the nav level but not at the page level.
Direct-URL access bypasses the matrix entirely.

| # | Path | Resource | Action | Notes |
|---|------|----------|--------|-------|
| 1 | `dispatches/new/page.tsx` | `sales` | `write` | Create dispatch form; consistent with dispatches/page.tsx gated as `sales:read` |
| 2 | `dispatches/[dispatchId]/page.tsx` | `sales` | `read` | View/edit dispatch detail; same resource as list page |
| 3 | `sales/new/page.tsx` | `sales` | `write` | Create sale form; parent `sales/page.tsx` already gated `sales:read` |
| 4 | `sales/[saleId]/page.tsx` | `sales` | `read` | View/edit sale detail |
| 5 | `purchases/new/page.tsx` | `purchases` | `write` | Create purchase form |
| 6 | `purchases/[purchaseId]/page.tsx` | `purchases` | `read` | View/edit purchase detail |
| 7 | `payments/new/page.tsx` | `payments` | `write` | Create payment form |
| 8 | `payments/[paymentId]/page.tsx` | `payments` | `read` | View/edit payment detail |
| 9 | `accounting/accounts/page.tsx` | `accounting-config` | `read` | Plan de Cuentas; parent settings-level page |
| 10 | `accounting/balances/page.tsx` | `journal` | `read` | Saldos por período; reads AccountBalancesService — financial data |
| 11 | `accounting/correlation-audit/page.tsx` | `journal` | `read` | Auditoría de correlativos; reads VoucherTypesService on journal data |
| 12 | `accounting/reports/page.tsx` | `reports` | `read` | Reportes Contables (ReportsPageClient); distinct from `informes/` |
| 13 | `accounting/journal/new/page.tsx` | `journal` | `write` | Create journal entry form |
| 14 | `accounting/journal/[entryId]/page.tsx` | `journal` | `read` | Journal entry detail view |
| 15 | `accounting/journal/[entryId]/edit/page.tsx` | `journal` | `write` | Journal entry edit form |
| 16 | `accounting/contacts/[contactId]/page.tsx` | `contacts` | `read` | Contact detail; parent contacts/page.tsx already gated `contacts:read` |

**Total Tier A: 16 pages**

### Tier B — AUTH-ONLY LEGITIMATE (cross-module or intentional bypass)

| # | Path | Rationale |
|---|------|-----------|
| 17 | `farms/page.tsx` | Intentional by design (established in explore #758, Section C Pattern C): uses `canAccess` for capability discovery, not as a page gate. The page renders for all org members but shows different data based on role. This cross-module behavior is documented as intentional. |
| 18 | `farms/[farmId]/page.tsx` | Same as farms/page.tsx — farm detail renders for all org members; data scope controlled by FarmsService. No sensitive financial data. |
| 19 | `lots/[lotId]/page.tsx` | Detail page for farm lots; same cross-module pattern as farms. No RBAC resource in the frozen union maps to `lots` or `farms` as a gated module. |

**Total Tier B: 3 pages**

### Tier C — SETTINGS SUB-PAGES (parent gate provides nav barrier; write actions need own gate)

These pages live under `settings/` whose parent `settings/page.tsx` IS gated by `accounting-config:read`.
Navigation barrier exists. However, direct-URL access bypasses it, and these pages perform mutations
(write operations) that should require `accounting-config:write`.

| # | Path | Resource | Action | Notes |
|---|------|----------|--------|-------|
| 20 | `settings/periods/page.tsx` | `accounting-config` | `write` | FiscalPeriodsService.list + mutations via PeriodList component |
| 21 | `settings/voucher-types/page.tsx` | `accounting-config` | `write` | VoucherTypesService mutations via VoucherTypesManager |
| 22 | `settings/operational-doc-types/page.tsx` | `accounting-config` | `write` | OperationalDocTypesService mutations |
| 23 | `settings/product-types/page.tsx` | `accounting-config` | `write` | ProductTypesService mutations |

**Total Tier C: 4 pages**

### Tier D — CROSS-MODULE HUB (ambiguous, requires architectural decision)

| # | Path | Notes |
|---|------|-------|
| 24 | `accounting/page.tsx` | The Contabilidad hub — renders module cards linking to journal, ledger, accounts, reports. Loads JournalService stats (entry count, last date). This is a dashboard-within-dashboard, not a single-resource page. Gating by `journal:read` would exclude `accounting-config`-only users who need to reach accounts. Gating by `accounting-config:read` excludes journal users. This is genuinely cross-module and requires an explicit architectural decision. |

**Total Tier D: 1 page**

---

## Reconciliation with W-2

W-2 (verify report #764) said "18 out-of-scope pages." The current grep finds **24**. The difference of 6:

- **New pages added after verify**: `dispatches/new`, `dispatches/[dispatchId]`, `sales/[saleId]`, `purchases/[purchaseId]`, `payments/[paymentId]`, `payments/new` — these are detail/create pages added by in-progress changes (`sales-dispatch-forms-ux`, `purchases-forms-ux`, `manual-journal-ux`). They were not in the codebase when W-2 was written.

The W-2 count of 18 corresponds roughly to Tier A (minus the 6 new) + Tier B + Tier C + Tier D.

---

## Test Impact

**Tests that mock `requireAuth`/`requireOrgAccess` for legacy pages**:

Only **1** file among the 24 legacy pages has an existing test:
- `accounting/journal/[entryId]/edit/__tests__/page.test.ts` — tests the RBAC guard logic (T3.1–T7.9, REQ-A.1). This test mocks `requireAuth` and `requireOrgAccess` as pass-through stubs (they return valid values, not testing auth itself). When this page is migrated to `requirePermission`, this test MUST be rewritten to use the canonical DCSN-005 pattern (`vi.mock("@/features/shared/permissions.server", ...)`). The edit-specific guard logic (DRAFT/POSTED/VOIDED/period-gate) must be preserved in the new test.

The other 23 legacy pages have **no existing test files**. Migration creates net-new test files per page (same pattern established by rbac-page-gating-fix — 16 new test files created there).

---

## Approaches

### Approach A — Page-by-page edit (repeat rbac-page-gating-fix pattern)

**What**: Edit each Tier A + Tier C page inline. Replace legacy two-step chain with single `requirePermission` call. Create `__tests__/page.test.ts` per page following DCSN-005. Strict TDD: RED → GREEN per page. Tier B stays untouched. Tier D gets a documented decision before touching.

**Pros**:
- Zero new abstractions — 100% consistent with established canonical pattern
- Each page independently testable and auditable
- Blast radius: one page at a time; revert is surgical
- No framework risk — pattern already proven by 16 pages in rbac-page-gating-fix

**Cons**:
- Repetitive — 20 pages is more mechanical work
- Two tiers (A=16 + C=4) with slightly different resource:action combinations

**Effort**: HIGH — ~20 page edits + ~20 new test files. But mechanical: pattern is frozen, no judgment needed per page (except Tier D decision).

**Recommendation**: TIER A + TIER C. Split into 2 PRs by risk category (Tier A detail/create pages vs Tier C settings pages) or by module cluster.

---

### Approach B — Codemod / script

**What**: Write a ts-morph or jscodeshift codemod that detects the legacy two-step chain pattern and replaces it with `requirePermission`. Resource:action mapping table drives the transform.

**Pros**:
- 20 pages in one pass
- No human error on the boilerplate
- Reusable if more pages are added later

**Cons**:
- Codemod setup overhead (ts-morph or jscodeshift, transform script, test harness)
- Pattern variations exist: `dispatches/new/page.tsx` has a `searchParams` guard BEFORE the auth block; `payments/new/page.tsx` has `type` validation. Codemod needs to handle these variants.
- Tests still need to be written manually per page (codemod cannot generate semantically correct mocks for each page's service layer)
- One-off value: 20 pages is a lot, but the pattern will be mostly gone after this change

**Effort**: MEDIUM upfront (codemod), but test writing remains HIGH. Net effort is similar to Approach A.

**Recommendation**: NOT recommended. The codemod would cover ~60% of the work; test writing still needs to happen page-by-page. Adds tooling risk with marginal gain.

---

### Approach C — Split by tier into separate changes

**What**:
- Change 1 (`rbac-legacy-auth-chain-migration`): Tier A only (16 pages — the detail/create/list pages with clear resource mappings)
- Change 2 (`rbac-settings-gate-migration`): Tier C (4 settings sub-pages — write gates)
- ADR only for Tier D (`accounting/page.tsx`)

**Pros**:
- Smaller review surface per change
- Tier C (settings pages with `write` action) requires semantic review distinct from Tier A (read-only resource checks)
- Tier D decision stays isolated

**Cons**:
- Two SDD cycles instead of one
- Tier C pages are already documented here — splitting adds overhead
- 4 settings pages are low-complexity

**Effort**: Same total, higher process overhead.

**Recommendation**: Viable if team prefers smaller PRs. But Tier A + Tier C can coexist in one change with a 2-PR split (same as DCSN-006 precedent from rbac-page-gating-fix).

---

## Recommendation

**Approach A — page-by-page edit, 2-PR split** within a single SDD change:

- **PR1** — Tier A, module sub-pages (read gates: `dispatches/*`, `sales/*`, `purchases/*`, `payments/*`, `accounting/*` pages 9–16). These are additive RBAC gates, no semantic risk.
- **PR2** — Tier C, settings sub-pages (write gates: `settings/periods`, `settings/voucher-types`, `settings/operational-doc-types`, `settings/product-types`). These use `accounting-config:write` — semantic review needed to confirm only `accounting-config:write`-capable roles (owner, admin, contador baseline) can mutate.

Tier B (farms, lots): leave untouched — intentional cross-module design.
Tier D (`accounting/page.tsx`): open architectural question — see Risks.

---

## Risks

### Risk 1 — `accounting/page.tsx` is genuinely cross-module (MEDIUM)
The hub page loads `JournalService` stats and renders links to all accounting sub-modules. Gating by a single resource is architecturally ambiguous. Options: (a) gate by `journal:read` since it loads journal stats, accepting that `accounting-config`-only users lose access; (b) gate by `accounting-config:read` as the "container" resource; (c) leave as auth-only since it renders no confidential data — just counts and links. **This requires an explicit decision before the page is touched.**

### Risk 2 — 1 existing test requires rewrite (LOW)
`accounting/journal/[entryId]/edit/__tests__/page.test.ts` mocks `requireAuth`/`requireOrgAccess`. Migration to `requirePermission` means this test file must be rewritten. The business logic assertions (T3.1–T7.9: DRAFT/POSTED/VOIDED/period-gate) must be preserved — they are NOT auth tests, they are edit-guard tests. The rewrite is mechanical but MUST NOT lose T3.1–T7.9 coverage.

### Risk 3 — `write` action for detail/edit pages (LOW)
Tier A includes edit/detail pages for sales, purchases, dispatches, payments, and journal entries. The resource:action mapping for detail pages uses `read` (you need `read` to view a sale detail), but edit/new pages use `write`. This is consistent — a user with `sales:read` can view individual sales but not create new ones. Verify the matrix: `write` implies `read` in the current permissions implementation (confirm before tasks).

### Risk 4 — New pages from in-progress changes (MEDIUM)
The 6 "new" legacy pages (`dispatches/new`, `dispatches/[dispatchId]`, `sales/[saleId]`, `purchases/[purchaseId]`, `payments/[paymentId]`, `payments/new`) were added by currently in-progress changes. Merging this migration change while those are in flight creates a merge conflict risk. **Coordinate: this change should be based on a branch that includes the latest main, after the in-progress changes land.**

### Risk 5 — `write` gate may restrict legitimate read access on forms (LOW)
Form pages (`/new`, `/edit`) load reference data (contacts, periods, accounts) before the user submits. If gated by `write`, a user with only `sales:read` will be redirected from `sales/new`. This is the CORRECT behavior — read access should not allow creating new records. Confirm this is the intended UX with the product owner.

### Risk 6 — settings pages: parent gate does not cascade to direct URL (INFO)
`settings/page.tsx` is gated by `accounting-config:read`. Its sub-pages (`/periods`, `/voucher-types`, `/operational-doc-types`, `/product-types`) are all mutation-heavy. A user who somehow navigates directly to `/acme/settings/periods` bypasses the parent gate. This change closes that gap by adding `accounting-config:write` gates. Side effect: if a user has `accounting-config:read` but NOT `accounting-config:write`, they can see the parent settings page but get redirected from sub-pages. This is intentional — sub-pages are admin-only mutation UIs.

### Risk 7 — No pages found outside `app/(dashboard)/[orgSlug]/` (INFO / CONFIRMED)
Fresh grep confirmed: all 24 legacy pages are within `app/(dashboard)/[orgSlug]/`. No legacy pattern found in other route groups. `app/api/` routes use separate API-level auth (confirmed by rbac-page-gating-fix explore #758).

---

## Ready for Proposal

**Yes** — with one open question for orchestrator to resolve with user:

**Q1**: What is the correct RBAC gate for `accounting/page.tsx` (Tier D)?
- Option (a): `requirePermission("journal", "read", orgSlug)` — gated by journal since it loads journal stats
- Option (b): `requirePermission("accounting-config", "read", orgSlug)` — gated as the accounting module container
- Option (c): leave as auth-only — it renders no confidential data, just link cards

This decision determines whether `accounting/page.tsx` is in scope for this change.

**Q2** (optional confirmation): Should this change include Tier C settings sub-pages, or should those be a separate follow-up change?

---

## Return Envelope

```
status: COMPLETE
executive_summary: |
  24 pages in app/(dashboard)/[orgSlug]/ still use legacy requireAuth+requireOrgAccess pattern.
  Categorized into 4 tiers: 16 Tier-A (clear RBAC gate needed), 3 Tier-B (intentional cross-module
  auth-only), 4 Tier-C (settings sub-pages, write gates needed), 1 Tier-D (cross-module hub, needs
  architectural decision). W-2 count of 18 was stale — 6 new pages added by in-progress changes.
  Approach A (page-by-page, 2-PR split) is recommended. One existing test requires rewrite.
  One open architectural question (accounting/page.tsx gate) before tasks can be fully specified.
artifacts:
  - openspec: openspec/changes/rbac-legacy-auth-chain-migration/exploration.md
  - engram: sdd/rbac-legacy-auth-chain-migration/explore
next_recommended: sdd-propose (with Q1 resolved)
risks:
  - accounting/page.tsx cross-module gate is architecturally ambiguous (MEDIUM)
  - 1 existing test (journal edit) requires full rewrite preserving T3.1-T7.9 business logic (LOW)
  - 6 new pages from in-progress changes — merge coordination needed (MEDIUM)
  - write-gate on form pages restricts read-only roles from creating records (intentional, LOW)
skill_resolution: injected
```
