# Archive Report: rbac-legacy-auth-chain-migration

**Change**: rbac-legacy-auth-chain-migration  
**Date**: 2026-04-19  
**Status**: ARCHIVED  
**Artifact Store**: hybrid (engram + filesystem)  
**Verdict**: ✅ PASS (0 CRITICAL, 0 WARNINGS, 2 SUGGESTIONS)

---

## A. Executive Summary

The `rbac-legacy-auth-chain-migration` change successfully gates 20 dashboard pages under `app/(dashboard)/[orgSlug]/` that were still using the legacy `requireAuth + requireOrgAccess` double chain. All 20 pages now call the canonical `requirePermission(resource, action, orgSlug)` pattern, with 4 additional pages intentionally marked as auth-only exceptions per DCSN-008.

- **20/20 pages migrated** with correct resource:action mappings per spec table
- **4/4 Tier B pages marked** with `// RBAC-EXCEPTION:` comment above auth block
- **40 new test assertions** (20 pages × 2 RBAC assertions per DCSN-005)
- **1723/1723 tests passing** (baseline 1683 + 40 new = 1723)
- **`tsc --noEmit` exit 0** (zero type errors)
- **4 grep gates pass** (F1.1 vitest, F1.2 tsc, F1.3 legacy chain, F1.4 Tier B markers, F1.5 requireRole anti-pattern)
- **Strict TDD Mode**: ✅ COMPLIANT (46 RED→GREEN task pairs verified)
- **0 CRITICAL issues**
- **0 WARNINGS**
- **2 SUGGESTIONS** (non-blocking, for future work)

The change is **ready for production merge**. Spec `rbac-page-gating` has been extended with REQ-PG.14 (20-page mapping) and REQ-PG.15 (4 Tier B exceptions + future prohibition).

---

## B. Intent & Scope

### Problem

20 dashboard pages under different modules (sales, purchases, payments, accounting, settings) were still using legacy `requireAuth + requireOrgAccess` — no RBAC matrix enforcement. Any authenticated org member (including custom roles with zero permissions) could direct-URL them. 4 additional pages (farms, lots, accounting hub) intentionally remained auth-only due to cross-module architecture or redundancy.

### Solution

Apply the canonical `requirePermission(resource, action, orgSlug)` pattern established in `rbac-page-gating-fix` (REQ-PG.1–13, shipped 2026-04-18). Each of the 20 target pages now:

1. Calls `requirePermission(resource, action, orgSlug)` with canonical resource:action before rendering
2. Redirects to `/${orgSlug}` on any failure (auth, org access, or permission)
3. Extracts `orgId` from the resolved result for downstream service calls
4. Has per-page `__tests__/page-rbac.test.ts` with authorized + forbidden assertions per DCSN-005
5. Preserves domain-fetch guards (redirects, notFound, period gates) for pages like `journal/[entryId]/edit`

The 4 Tier B exception pages remain on the legacy chain but are now marked with a code comment (DCSN-008) and enumerated in REQ-PG.15 as intentional.

### Scope

| Category | Count | Status |
|----------|-------|--------|
| Pages migrated (Tier A + C) | 20 | ✅ Complete |
| Tier B pages marked as exceptions | 4 | ✅ Complete |
| Test files created | 20 | ✅ Complete |
| Test assertions | 40 (20 × 2) | ✅ All pass |
| Pages per PR split | PR1: 16 read, PR2: 4 write + rewrite | ✅ Applied |

**Tier A (16 pages — module sub-pages, reads and writes)**:
- Dispatches: new, detail (sales:write)
- Sales: new, detail (sales:write)
- Purchases: new, detail (purchases:write)
- Payments: new, detail (payments:write)
- Accounting/journal: new, detail, edit (journal:write on new/edit, read on detail)
- Accounting/balances, correlation-audit, accounts (journal:read, accounting-config:read)
- Accounting/reports (reports:read)
- Accounting/contacts/[contactId] (contacts:read)

**Tier C (4 pages — settings, all accounting-config:write)**:
- settings/periods
- settings/voucher-types
- settings/operational-doc-types
- settings/product-types

**Tier B (4 pages — intentional exceptions, NOT migrated)**:
- farms/page.tsx, farms/[farmId]/page.tsx (cross-module, no farms resource)
- lots/[lotId]/page.tsx (cross-module, no lots resource)
- accounting/page.tsx (hub landing; sub-sections already gated)

---

## C. Implementation Approach

### Design Decisions

| Decision | Rationale | Reference |
|----------|-----------|-----------|
| DCSN-006: 5 resource-coherent apply batches | Parallelizable review; reduces per-batch cognitive load; sales/purchases/payments/journal/accounting-settings | design.md |
| DCSN-007: journal/[entryId]/edit mock-swap + sibling page-rbac.test.ts | Preserve T3.1–T7.9 (DRAFT/POSTED/VOIDED/period-gate coverage) in existing `page.test.ts`; new `page-rbac.test.ts` for RBAC layer | design.md |
| DCSN-008: RBAC-EXCEPTION marker above first try{requireAuth} block | Signals intentional auth-only; codifies team decision 2026-04-19; future prohibition on unmarked legacy chain | design.md |
| DCSN-009: Long-form `let orgId: string` for pages that consume orgId; short-form accepted when unused | TypeScript definite-assignment; pages like `accounting/reports` that don't use orgId can skip extraction | design.md |
| DCSN-010: Domain-fetch redirects (`notFound()`, `redirect('/<module>')`) preserved through migration | `journal/[entryId]/edit` rewrites auth mocks but preserves all guard logic (period-closed, VOIDED state, missing entry) | design.md |

### Execution Path

**Phase 1: Proposal** (2026-04-19)  
→ Define scope (20 pages), approach (canonical pattern, DCSN reuse), Tier B exception rationale

**Phase 2: Spec** (2026-04-19)  
→ REQ-PG.14 (20-page mapping table with scenarios) + REQ-PG.15 (4 Tier B with markers + future prohibition)

**Phase 3: Design** (2026-04-19)  
→ 5 decisions (DCSN-006 through DCSN-010), batch strategy, journal/edit DCSN-007 special handling

**Phase 4: Tasks** (2026-04-19)  
→ 46 tasks (20 RED + 20 GREEN + 4 REFACTOR + 2 rewrite special case), grouped per batch, per DCSN-006

**Phase 5: Apply** (2026-04-19)  
→ All 46 tasks complete; apply-progress confirms RED→GREEN discipline; all 20 pages migrated; DCSN-007 journal/edit preserved; Tier B markers added

**Phase 6: Verify** (2026-04-19)  
→ 4 grep gates PASS; REQ-PG.14 + REQ-PG.15 compliance matrix 100%; 1723/1723 tests; tsc clean; 2 SUGGESTIONS (future work)

**Phase 7: Archive** (2026-04-19, this report)  
→ REQ-PG.14/15 merged into openspec/specs/rbac-page-gating/spec.md; change folder moved; archive-report saved to engram and filesystem

---

## D. Requirements Compliance Matrix

| REQ | Aspect | Verdict | Evidence |
|-----|--------|---------|----------|
| REQ-PG.14 | All 20 pages call `requirePermission` with correct resource:action | ✅ PASS | 20 pages audited; all use exact resource:action from spec table; verify-report confirms |
| REQ-PG.14 | No orphan `requireAuth` / `requireOrgAccess` in migrated 20 pages | ✅ PASS | `grep -rlE "requireAuth\(|requireOrgAccess\(" app/(dashboard)/[orgSlug]/**/page.tsx` returns ONLY 4 Tier B files |
| REQ-PG.14 | 20 test files exist with 2 RBAC assertions each (DCSN-005 pattern) | ✅ PASS | All 20 files exist; 40 assertions total; all pass (baseline 1683 + 40 = 1723) |
| REQ-PG.15 | All 4 Tier B pages have `// RBAC-EXCEPTION: <reason>` marker | ✅ PASS | farms/page.tsx L17, farms/[farmId]/page.tsx L14, lots/[lotId]/page.tsx L15, accounting/page.tsx L26 all have marker |
| REQ-PG.15 | `grep -E "requireAuth\(|requireOrgAccess\(" app/(dashboard)/[orgSlug]/**/page.tsx` returns EXACTLY 4 files | ✅ PASS | F1.3 gate returns 4 files (farms, farms/[farmId], lots/[lotId], accounting) |
| REQ-PG.15 | Future prohibition: new pages MUST use `requirePermission` or carry `// RBAC-EXCEPTION:` | ✅ DOCUMENTED | Spec REQ-PG.15 second paragraph codifies this rule; verifiable in future code review |

**Verdict**: **ALL REQUIREMENTS COMPLIANT** (6/6 REQ-PG.14/15 aspects PASS)

---

## E. All 20 Migrated Pages — Detailed Audit

### Tier A: Module Sub-Pages (16 pages)

| # | Page | Resource | Action | Test File | Legacy Removed | Domain Redirects | RBAC Assertions | Status |
|---|------|----------|--------|-----------|---|---|---|---|
| 1 | dispatches/new/page.tsx | sales | write | ✅ | ✅ | none needed | 2 | ✅ |
| 2 | dispatches/[dispatchId]/page.tsx | sales | write | ✅ | ✅ | `→ /dispatches` | 2 | ✅ |
| 3 | sales/new/page.tsx | sales | write | ✅ | ✅ | none needed | 2 | ✅ |
| 4 | sales/[saleId]/page.tsx | sales | write | ✅ | ✅ | `→ /sales` | 2 | ✅ |
| 5 | purchases/new/page.tsx | purchases | write | ✅ | ✅ | none needed | 2 | ✅ |
| 6 | purchases/[purchaseId]/page.tsx | purchases | write | ✅ | ✅ | `→ /purchases` | 2 | ✅ |
| 7 | payments/new/page.tsx | payments | write | ✅ | ✅ | none needed | 2 | ✅ |
| 8 | payments/[paymentId]/page.tsx | payments | write | ✅ | ✅ | `→ entity` | 2 | ✅ |
| 9 | accounting/accounts/page.tsx | accounting-config | read | ✅ | ✅ | none | 2 | ✅ |
| 10 | accounting/balances/page.tsx | journal | read | ✅ | ✅ | none | 2 | ✅ |
| 11 | accounting/correlation-audit/page.tsx | journal | read | ✅ | ✅ | none | 2 | ✅ |
| 12 | accounting/reports/page.tsx | reports | read | ✅ | ✅ | none | 2 | ✅ |
| 13 | accounting/journal/new/page.tsx | journal | write | ✅ | ✅ | none | 2 | ✅ |
| 14 | accounting/journal/[entryId]/page.tsx | journal | read | ✅ | ✅ | `notFound()` | 2 | ✅ |
| 15 | accounting/journal/[entryId]/edit/page.tsx | journal | write | ✅ DCSN-007 | ✅ | multiple guards | 2 | ✅ |
| 16 | accounting/contacts/[contactId]/page.tsx | contacts | read | ✅ | ✅ | `notFound()` | 2 | ✅ |

### Tier C: Settings (4 pages)

| # | Page | Resource | Action | Test File | Legacy Removed | RBAC Assertions | Status |
|---|------|----------|--------|-----------|---|---|---|
| 17 | settings/periods/page.tsx | accounting-config | write | ✅ | ✅ | 2 | ✅ |
| 18 | settings/voucher-types/page.tsx | accounting-config | write | ✅ | ✅ | 2 | ✅ |
| 19 | settings/operational-doc-types/page.tsx | accounting-config | write | ✅ | ✅ | 2 | ✅ |
| 20 | settings/product-types/page.tsx | accounting-config | write | ✅ | ✅ | 2 | ✅ |

**DCSN-007 special handling**: `journal/[entryId]/edit` rewrites auth mocks (from generic `requireAuth + requireOrgAccess` to `requirePermission("journal", "write", orgSlug)`) while preserving all 8 existing business-logic assertions (T3.1, T3.2, T3.2b, T3.4, T3.4b, T7.8, T7.9, and one additional), added sibling `page-rbac.test.ts` for 2 new RBAC assertions.

---

## F. Special Findings

### DCSN-007 Journal Edit Preservation

The `accounting/journal/[entryId]/edit/page.tsx` underwent rewrite with special care:

**Before**: `__tests__/page.test.ts` used generic `vi.mock("@/features/shared", ...)` double-chain mocks  
**After**: Same test file now mocks `vi.mock("@/features/shared/permissions.server", ... requirePermission ...)` with the canonical result structure; all 8 business-logic assertions (DRAFT/POSTED/VOIDED states, period-closed, entry-not-found, etc.) preserved line-for-line  
**New**: Sibling `__tests__/page-rbac.test.ts` added with 2 RBAC assertions (authorized + forbidden)

This approach preserves the critical test coverage (domain logic) while cleanly separating auth testing (DCSN-005 pattern).

### Tier B Markers

All 4 Tier B pages carry the marker with standardized text:

```typescript
// RBAC-EXCEPTION: [reason]. Decision: rbac-legacy-auth-chain-migration 2026-04-19.
```

This allows future grep gates to detect unmarked legacy chains as violations.

---

## G. Metrics

| Metric | Value | Baseline | Delta |
|--------|-------|----------|-------|
| Pages migrated | 20 | — | — |
| Pages with `requirePermission` call | 20 | — | — |
| Test files created | 20 | — | — |
| RBAC test assertions | 40 | — | +40 |
| Total test count | 1723 | 1683 | +40 |
| Vitest pass rate | 100% (1723/1723) | 100% (1683/1683) | ✅ maintained |
| tsc --noEmit exit code | 0 | 0 | ✅ maintained |
| Grep F1.3 (legacy chain = 4 files) | PASS | — | — |
| Grep F1.4 (Tier B markers = 4) | PASS | — | — |
| Grep F1.5 (requireRole = 0) | PASS | — | — |
| Strict TDD compliance | 100% (46/46 tasks RED→GREEN) | — | ✅ verified |

---

## H. Delivered Requirements

### From Spec (REQ-PG.14 and REQ-PG.15)

- ✅ **REQ-PG.14**: Legacy Auth-Chain Migration Mapping (20 Pages)
  - 20 pages migrated with canonical `requirePermission` calls
  - 20 pages have correct resource:action from spec table
  - 0 orphan `requireAuth` / `requireOrgAccess` in migrated set
  - 20 test files with DCSN-005 pattern (vi.hoisted, node env, 2 assertions each)

- ✅ **REQ-PG.15**: Tier B Intentional Auth-Only Exceptions
  - 4 pages marked with `// RBAC-EXCEPTION: <reason>` comment
  - 4 pages remain on legacy `requireAuth + requireOrgAccess`
  - Future prohibition codified: new pages must use `requirePermission` or carry marker

---

## I. Suggestions (Non-Blocking)

**SUGGESTION-1: Comment on `accounting/reports/page.tsx` short-form usage**

The `accounting/reports/page.tsx` uses short-form `requirePermission` (no `orgId` extraction) because `orgId` is not consumed downstream. However, future maintainers adding service calls might miss this and introduce silent bugs. A code comment like:

```typescript
// Note: orgId not extracted — reports/page.tsx does not consume it.
// If a service call is added that needs orgId, extract via: const result = await requirePermission(...); const orgId = result.orgId;
```

would prevent accidental silent errors.

**SUGGESTION-2: Package.json script for F1.4 grep gate**

The F1.4 shell loop gate (checking all 4 Tier B files have `RBAC-EXCEPTION` marker) has a quoting fragility with paths containing parentheses. Consider adding a `package.json` script:

```json
"test:rbac-gates": "grep -rL \"RBAC-EXCEPTION\" app/(dashboard)/[orgSlug]/farms/page.tsx app/(dashboard)/[orgSlug]/farms/[farmId]/page.tsx app/(dashboard)/[orgSlug]/lots/[lotId]/page.tsx app/(dashboard)/[orgSlug]/accounting/page.tsx && echo 'F1.4 PASS' || echo 'F1.4 FAIL: missing marker'"
```

This makes the gate reliably re-runnable in CI without shell quoting issues.

---

## J. Files Changed

- **25 page.tsx files modified** (20 migrated + 4 Tier B markers + 1 unchanged reference)
  - All 20 migrated pages: `requireAuth` / `requireOrgAccess` replaced with `requirePermission`
  - All 4 Tier B pages: marker added above `try { const session = await requireAuth() }`

- **20 new `__tests__/page-rbac.test.ts`** (one per migrated page)
  - Each with 2 RBAC assertions (authorized-renders, forbidden-redirects)
  - vi.hoisted() for mock isolation per DCSN-005

- **1 rewritten `__tests__/page.test.ts`** (journal/[entryId]/edit only)
  - Auth mock updated to `requirePermission` (DCSN-007)
  - All 8 existing business-logic assertions preserved

- **openspec/specs/rbac-page-gating/spec.md extended**
  - REQ-PG.14 (20-page migration mapping + 4 scenarios) added
  - REQ-PG.15 (4 Tier B exceptions + future prohibition + 3 scenarios) added
  - Capability statement updated to reflect 36 total gated pages (16 original + 20 migrated)
  - Acceptance criteria extended with REQ-PG.14/15 sub-items

---

## K. Decisions Locked

- **DCSN-006**: 5 resource-coherent apply batches (sales, purchases, payments, journal, accounting-settings) — reduces per-batch cognitive load during review
- **DCSN-007**: journal/[entryId]/edit mock-swap + sibling page-rbac.test.ts — preserves T3.1–T7.9 coverage; cleanly separates auth from domain testing
- **DCSN-008**: RBAC-EXCEPTION marker above first `try { requireAuth() }` block — signals intentional decision; future prohibition on unmarked legacy chain
- **DCSN-009**: Long-form `let orgId: string` for pages that consume orgId; short-form acceptable when unused — follows TypeScript definite-assignment; matches `accounting/reports` usage
- **DCSN-010**: Domain-fetch redirects (`notFound()`, `redirect('/<module>')`) preserved through migration — journal/edit guards (period-closed, POSTED auto-redirect, VOIDED redirect) remain intact

---

## L. Next Steps for Team

### Immediate (Post-Archive)

1. **Merge commit to main** — orchestrator will stage all changes (spec + archive folder + state) in one commit per SDD protocol
2. **Verify in CI** — grep gates F1.3/F1.4/F1.5 re-run on merged main; vitest 1723/1723 confirm; `tsc --noEmit` exit 0 confirm
3. **Team sync** — brief walkthrough of DCSN-008 (RBAC-EXCEPTION markers) so reviewers catch unmarked legacy chain in future PRs

### Future (New Modules)

- **When creating new `page.tsx` under `app/(dashboard)/[orgSlug]/`**: MUST use `requirePermission` (preferred) OR carry `// RBAC-EXCEPTION: <reason>` comment (exception approval required). Unmarked legacy chain is now forbidden per REQ-PG.15.
- **When adding service calls to `accounting/reports/page.tsx`**: upgrade to long-form `orgId` extraction (suggestion-1).
- **For CI/CD**: consider adding `test:rbac-gates` script (suggestion-2) to reliably verify Tier B markers in pipeline.

---

## Return Envelope

- status: COMPLETE
- executive_summary: All 20 dashboard pages migrated from legacy auth chain to canonical `requirePermission` pattern with correct resource:action mappings. 4 Tier B exceptions marked and documented. Spec extended with REQ-PG.14/15. Verify PASS (0 CRITICAL, 0 WARNINGS, 2 SUGGESTIONS). Ready for production merge.
- actions:
  - REQ-PG.14 and REQ-PG.15 synced to openspec/specs/rbac-page-gating/spec.md (36 total gated pages now documented)
  - Change folder moved: openspec/changes/rbac-legacy-auth-chain-migration/ → openspec/changes/archive/2026-04-19-rbac-legacy-auth-chain-migration/
  - Archive report created and saved
  - Engram: archive-report and state observations saved
- files_modified_or_moved:
  - openspec/specs/rbac-page-gating/spec.md (extended with REQ-PG.14, REQ-PG.15, updated capability)
  - openspec/changes/archive/2026-04-19-rbac-legacy-auth-chain-migration/* (all source artifacts moved)
- commit_preview_suggestion: |
  feat(rbac): migrate 20 pages off legacy auth chain to requirePermission

  - 16 Tier A + 4 Tier C pages now use canonical requirePermission gate
  - 4 Tier B pages carry RBAC-EXCEPTION markers (intentional auth-only)
  - +40 tests (20 new page-rbac.test.ts, DCSN-005 pattern)
  - journal/[entryId]/edit preserves T3.1–T7.9 via DCSN-007 mock-swap
  - spec rbac-page-gating extended: REQ-PG.14 (mapping), REQ-PG.15 (exceptions)
  - grep gates: F1.3/F1.4/F1.5 all pass
  - tsc --noEmit: exit 0
  - vitest: 1723/1723 passing

---

## Artifact References

- **Proposal**: #768 — [sdd/rbac-legacy-auth-chain-migration/proposal]
- **Spec**: #772 — [sdd/rbac-legacy-auth-chain-migration/spec] (source)
- **Design**: [latest topic] — [sdd/rbac-legacy-auth-chain-migration/design]
- **Tasks**: [latest topic] — [sdd/rbac-legacy-auth-chain-migration/tasks]
- **Apply-progress**: #775 — [sdd/rbac-legacy-auth-chain-migration/apply-progress]
- **Verify-report**: [latest topic] — [sdd/rbac-legacy-auth-chain-migration/verify-report]
- **Archive-report**: [this document] — [sdd/rbac-legacy-auth-chain-migration/archive-report]
- **State**: CLOSED (PASS) — [sdd/rbac-legacy-auth-chain-migration/state]
