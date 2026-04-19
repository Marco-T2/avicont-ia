# Design: rbac-legacy-auth-chain-migration

**Change**: `rbac-legacy-auth-chain-migration`
**Date**: 2026-04-19
**Status**: APPROVED
**Artifact Store**: hybrid (engram + filesystem)
**Prior**: explore #767, proposal #768, spec #772, rbac-page-gating-fix archive (DCSN-001…005)

---

## A. Context

20 dashboard `page.tsx` files under `app/(dashboard)/[orgSlug]/` still run the legacy triple `requireAuth → requireOrgAccess → domain fetch` chain. They need the canonical `requirePermission(resource, action, orgSlug)` gate frozen by `rbac-page-gating-fix` (REQ-PG.1–13). Additionally, 4 `Tier B` pages (`farms`, `farms/[farmId]`, `lots/[lotId]`, `accounting/page.tsx`) remain intentionally on the legacy chain and must carry an `RBAC-EXCEPTION` marker (REQ-PG.15).

This design INHERITS from `rbac-page-gating-fix`:

- **DCSN-002/003** — single `try { const result = await requirePermission(...); orgId = result.orgId; } catch { redirect(\`/${orgSlug}\`); }` with `let orgId: string`.
- **DCSN-005** — per-page test scaffold: `vi.hoisted` + `mockRedirect` + `mockRequirePermission`, 2 assertions (authorized-renders + forbidden-redirects), `.test.ts` node env.
- **Canonical action taxonomy** — `"read" | "write"` (binary; no create/update/delete variants).

NEW decisions (DCSN-006…010) address batching, coexistence with pre-existing business-logic tests, the `RBAC-EXCEPTION` marker, short-vs-long form selection, and preservation of domain-fetch redirects.

---

## B. Decisions

### DCSN-006 — Batching strategy: 5 resource-coherent batches

**Decision**: Split the 20 pages into 5 apply batches grouped by resource cluster. Each batch is a self-contained commit (pages + tests).

| Batch | Pages | Count | Resource cluster |
|-------|-------|-------|------------------|
| **B1 — Sales cluster** | `sales/new`, `sales/[saleId]`, `dispatches/new`, `dispatches/[dispatchId]` | 4 | `sales:write` ×4 |
| **B2 — Purchases + Payments cluster** | `purchases/new`, `purchases/[purchaseId]`, `payments/new`, `payments/[paymentId]` | 4 | `purchases:write`, `payments:write` |
| **B3 — Accounting reads** | `accounting/accounts`, `accounting/balances`, `accounting/correlation-audit`, `accounting/reports`, `accounting/contacts/[contactId]` | 5 | `accounting-config:read`, `journal:read`, `reports:read`, `contacts:read` |
| **B4 — Journal writes + edit rewrite** | `accounting/journal/new`, `accounting/journal/[entryId]`, `accounting/journal/[entryId]/edit` | 3 | `journal:read` + `journal:write` (includes test rewrite — see DCSN-007) |
| **B5 — Settings + Tier B markers** | `settings/periods`, `settings/voucher-types`, `settings/operational-doc-types`, `settings/product-types` + 4 Tier B marker inserts | 4 + 4 | `accounting-config:write` ×4 + RBAC-EXCEPTION comments |

**Rationale**: Resource clusters minimize cognitive context switching during review, and batch B4 is isolated because it carries the highest semantic risk (T3.1–T7.9 test rewrite). No concurrent in-flight changes exist (`sales-dispatch-forms-ux`, `purchases-forms-ux`, `manual-journal-ux` all merged per task-1), so flat sequential is safe; the cluster grouping is for REVIEWER clarity, not merge-conflict avoidance.

**Rejected — 2-PR split (proposal's original)**: The proposal suggested PR1 reads, PR2 writes. After re-verification, action taxonomy is binary and all `/new` + `/[id]` pages are `:write` — a "reads vs writes" split collapses to 15 writes vs 5 reads, not a meaningful risk axis. Resource-cluster batches give reviewers tighter semantic groups.

**Rejected — flat 20-item sequence**: Loses review coherence; reviewer can't answer "is `accounting-config:write` the right gate for all 4 settings pages?" without jumping around.

---

### DCSN-007 — Coexistence of new RBAC test with existing T3.* business-logic tests

**Decision**: For `accounting/journal/[entryId]/edit/page.tsx`, the NEW canonical RBAC test file lives at `edit/__tests__/page-rbac.test.ts` (new file). The EXISTING business-logic test stays at `edit/__tests__/page.test.ts` but its `@/features/shared` mock block MUST be SWAPPED to `@/features/shared/permissions.server` mocking `requirePermission` — preserving all T3.1–T7.9 assertions unchanged.

**Concrete diff** in `edit/__tests__/page.test.ts`:

```ts
// BEFORE (lines 32–35):
vi.mock("@/features/shared", () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "clerk-user-1" }),
  requireOrgAccess: vi.fn().mockResolvedValue("org-db-id"),
}));

// AFTER:
vi.mock("@/features/shared/permissions.server", () => ({
  requirePermission: vi
    .fn()
    .mockResolvedValue({ orgId: "org-db-id", session: { userId: "clerk-user-1" }, role: "owner" }),
}));
```

T3.1–T7.9 assertion bodies stay byte-for-byte identical. The business-logic tests mock `requirePermission` to resolve (authorized path) so the pre-existing guard tests on DRAFT/POSTED/VOIDED/period-status continue to exercise the same page branches.

**Rationale**:
- Two test files per page is already the `rbac-page-gating-fix` precedent for upgrade pages — separation of concerns: RBAC gate vs business-logic.
- Same-commit test rewrite satisfies DCSN-004 atomicity (inherited) — no orphan `@/features/shared` import or mock.
- File naming: `page.test.ts` (business logic, pre-existing) + `page-rbac.test.ts` (new gate) — mirrors REQ-PG.11's `page-rbac.test.ts` convention for upgrade pages.

**Rejected — consolidate into single file**: Forces T3.* authors to re-review unrelated gate assertions; increases merge-conflict surface with future business-logic changes.

**Rejected — delete T3.* entirely**: Explicitly prohibited by proposal success criterion "T3.1–T7.9 preserved".

---

### DCSN-008 — `RBAC-EXCEPTION` marker: placement, canonical form, grep gate

**Decision**: For each of the 4 Tier B pages, insert the marker as a standalone comment line IMMEDIATELY ABOVE the first `try {` containing `requireAuth`. This places the exception next to the code it exempts, visible in diffs and inline blame.

**Canonical form**:

```ts
// RBAC-EXCEPTION: <reason per REQ-PG.15 table>. Decision: rbac-legacy-auth-chain-migration 2026-04-19.
let userId: string;
try {
  const session = await requireAuth();
  userId = session.userId;
} catch {
  redirect("/sign-in");
}
```

The four reason texts come verbatim from REQ-PG.15 ("Cross-module auth-only…" / "Dashboard hub with summary cards only…").

**Grep gate** (verify phase REQ-PG.15 acceptance):

```bash
# Gate 1 — legacy chain MUST appear in EXACTLY 4 files
grep -lE "requireAuth\(|requireOrgAccess\(" "app/(dashboard)/[orgSlug]"/**/page.tsx | wc -l
# Expected: 4

# Gate 2 — every legacy-chain file MUST carry the marker
for f in $(grep -lE "requireAuth\(" "app/(dashboard)/[orgSlug]"/**/page.tsx); do
  grep -q "RBAC-EXCEPTION:" "$f" || echo "MISSING MARKER: $f"
done
# Expected: no output

# Gate 3 — no requireRole regressions (REQ-PG.8 preserved)
grep -rE "requireRole\(" "app/(dashboard)"/**/page.tsx
# Expected: no output
```

The 4 expected files: `farms/page.tsx`, `farms/[farmId]/page.tsx`, `lots/[lotId]/page.tsx`, `accounting/page.tsx`.

**Rejected — marker above imports**: Detaches reason from the gated code; easier to silently strip in a later refactor.

**Rejected — JSDoc `@rbac-exception` block**: No tooling consumes it; plain comment + grep is the tested contract.

---

### DCSN-009 — Long-form pattern for all 20 migrated pages

**Decision**: All 20 migrated pages use the LONG-FORM pattern (`let orgId: string` + destructure `result.orgId`), NOT the short-form (`await requirePermission(...); /* orgId unused */`).

**Rule** (for future changes): "Use long-form when the page body references `orgId`; short-form only when `orgId` is unused." After inspecting all 20 pages, every one of them fetches domain-scoped data (e.g. `saleService.getById(orgId, ...)`, `periodsService.list(orgId)`, `contactsService.getById(orgId, ...)`) — so ALL 20 pages need `orgId` → long-form is mandatory across the board.

**Rationale**: Inspection of `sales/new`, `sales/[saleId]`, `settings/periods`, `dispatches/[dispatchId]`, `accounting/contacts/[contactId]`, `accounting/journal/[entryId]/edit` confirmed every Tier A + Tier C page has at least one downstream service call requiring `orgId`. Short-form is a contextual accept for hub pages only (e.g. a hypothetical landing page rendering only static JSX) — none of the 20 qualify.

---

### DCSN-010 — Preservation of domain-fetch `notFound` / `redirect` blocks

**Decision**: The migration ONLY replaces the `requireAuth` + `requireOrgAccess` try/catch blocks. Downstream domain-fetch `try/catch` blocks (e.g. `try { sale = await saleService.getById(orgId, saleId); } catch { redirect(\`/${orgSlug}/sales\`); }` and `try { entry = await journalService.getById(...); } catch { notFound(); }`) STAY untouched.

**Rationale**:
- `requirePermission` internalizes auth + org access + matrix lookup ONLY. It does NOT fetch domain entities.
- Removing domain-fetch redirects would break "entity not found" UX (404 / module-landing bounce). These are semantically independent from the RBAC gate.
- Verified patterns in inspected pages: `sales/[saleId]` redirects to `/${orgSlug}/sales` on missing sale; `journal/[entryId]/edit` calls `notFound()` on missing entry and `redirect` on period-closed — ALL preserved.

**Apply-phase contract**: the RED test asserts ONLY the RBAC redirect (to `/${orgSlug}`). Domain-fetch redirects stay exercised by pre-existing business-logic tests (DCSN-007).

---

## C. Data Flow

```
                 ┌─── Clerk middleware (proxy.ts) ───┐
                 │ unauth → /sign-in                  │
Request ────────►│                                    │
                 └──────────┬─────────────────────────┘
                            ▼
              page.tsx server component
                            │
                            ▼
      ┌───── requirePermission(res, action, slug) ─────┐
      │  requireAuth → requireOrgAccess → matrix lookup│
      │  returns { session, orgId, role }              │
      └──────────────────┬─────────────────────────────┘
              success ◄──┴──► throw ─► redirect(`/${orgSlug}`)
                │
                ▼
      orgId used by domain services
                │
                ├──► notFound()   (entity missing)
                ├──► redirect()   (domain-fetch fallback, preserved per DCSN-010)
                └──► JSX render
```

---

## D. File Changes Summary

| Kind | Count | Files |
|------|-------|-------|
| MODIFY page (long-form migration) | 20 | Tier A × 16 + Tier C × 4 (see spec REQ-PG.14) |
| MODIFY page (RBAC-EXCEPTION marker) | 4 | `farms`, `farms/[farmId]`, `lots/[lotId]`, `accounting/page.tsx` |
| CREATE test (`__tests__/page-rbac.test.ts`) | 19 | All migrated pages EXCEPT `journal/[entryId]/edit` |
| MODIFY test (mock swap, T3.* preserved) | 1 | `journal/[entryId]/edit/__tests__/page.test.ts` |
| CREATE test (new RBAC file) | 1 | `journal/[entryId]/edit/__tests__/page-rbac.test.ts` |

Total: 24 MODIFY + 20 CREATE.

No new infrastructure. No changes to `permissions.server.ts`, the `Resource` union, or `proxy.ts`.

---

## E. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| `journal/edit/page.test.ts` mock swap breaks T3.* silently | **HIGH** | DCSN-007 pins exact mock diff; RED test must still fail for T3.2/T3.4 (redirect assertions) before GREEN |
| Tier B marker stripped by future refactor | Medium | DCSN-008 grep gate in verify phase; Gate 2 fails loudly |
| Domain-fetch redirect deleted during migration | Medium | DCSN-010 explicit; apply-phase RED test asserts ONLY RBAC redirect, leaves business-logic tests owning domain redirects |
| Spec REQ-PG.14 maps `[dispatchId]`, `[saleId]`, `[purchaseId]`, `[paymentId]` to `:write` — proposal said `:read` | Medium (already flagged in spec) | Code inspection confirmed: all 4 render edit forms → `:write` is correct. Orchestrator notified via spec RISK flag; no design rewrite needed |
| No other page has existing tests that mock `requireAuth`/`requireOrgAccess` | **CONFIRMED NON-RISK** | Only `journal/edit/__tests__/page.test.ts` mocks legacy auth (verified via Grep in design phase). All other 19 pages are net-new test files |
| `canAccess` usage inside Tier B `farms/page.tsx` survives the migration | Low | `canAccess` imports from `@/features/shared/permissions.server` and is orthogonal to the `requireAuth` chain. RBAC-EXCEPTION marker does NOT require removing canAccess. Verified in inspection |

**Mock-cascade grep verification (design-phase)**:
```
app/(dashboard)/[orgSlug]/accounting/journal/[entryId]/edit/__tests__/page.test.ts
```
ONE file (the journal edit test) is the sole mock-swap target. All other migrated pages get net-new test files.

---

## F. Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Unit (per page) | RBAC gate invoked with correct `(resource, action, orgSlug)`; redirect on throw | `page-rbac.test.ts` per DCSN-005 — 2 assertions |
| Unit (journal edit) | T3.1–T7.9 business-logic guards preserved | `page.test.ts` with swapped mock, same assertions |
| Static | No legacy chain outside Tier B | Grep Gate 1 (DCSN-008) |
| Static | Every legacy-chain file has marker | Grep Gate 2 (DCSN-008) |
| Static | No `requireRole` regressions | Grep Gate 3 (DCSN-008) |
| Types | `tsc --noEmit` exit 0 | REQ-PG.12 inherited |

**TDD order per page**: RED (test asserts unimplemented `requirePermission` call) → GREEN (edit page) → REFACTOR (drop `requireAuth`, `requireOrgAccess`, unused `userId` variable).

---

## G. Migration / Rollout

Single-commit per batch (B1–B5). No feature flags, no schema changes, no data migration. Rollback = revert commit(s).

---

## H. Open Questions

None. Spec RISK about `:read` vs `:write` for `[id]` pages was resolved during code inspection (all 4 are edit forms → `:write` confirmed).

---

## I. Skill Resolution

injected — Next.js 16, TypeScript strict, Clerk auth cascade, conventional commits, Resource-union freeze, Strict TDD Mode.

---

## Return Envelope

- **status**: COMPLETE
- **executive_summary**: Design inherits DCSN-001/002/003/004/005 from `rbac-page-gating-fix` and adds 5 new decisions. DCSN-006 groups the 20 migrations into 5 resource-coherent batches. DCSN-007 isolates the journal-edit T3.* test preservation via a focused mock swap + sibling `page-rbac.test.ts`. DCSN-008 pins the `RBAC-EXCEPTION` marker placement and the 3-gate grep verifier. DCSN-009 mandates long-form across all 20 (all consume `orgId`). DCSN-010 preserves domain-fetch `notFound`/`redirect` blocks. 24 MODIFY + 20 CREATE; no new infrastructure.
- **artifacts**: `openspec/changes/rbac-legacy-auth-chain-migration/design.md` + engram `sdd/rbac-legacy-auth-chain-migration/design`
- **next_recommended**: `sdd-tasks`
- **decisions**:
  - DCSN-006: 5 resource-coherent apply batches; reviewer-clarity driven, not merge-driven
  - DCSN-007: journal-edit keeps `page.test.ts` (T3.* intact, mock swapped) + gains new `page-rbac.test.ts`
  - DCSN-008: marker as standalone `// RBAC-EXCEPTION: <reason>` immediately above first `try`; 3 grep gates
  - DCSN-009: long-form mandatory for all 20 (every page consumes `orgId`)
  - DCSN-010: domain-fetch `try/catch` blocks preserved; only auth chain replaced
- **risks**:
  - HIGH: journal-edit mock swap — mitigated by DCSN-007 exact-diff pin + same-commit contract
  - Medium: Tier B marker regression — grep Gate 2 in verify phase
  - Confirmed non-risk: no other page has legacy-auth test mocks (verified via Grep)
- **batching_summary**:
  - Batch strategy: 5 resource-coherent batches, commit-per-batch
  - Total apply batches: 5 (B1 sales ×4, B2 purchases+payments ×4, B3 accounting reads ×5, B4 journal ×3, B5 settings+Tier B ×8)
- **skill_resolution**: injected
