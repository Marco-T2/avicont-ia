# Archive — monthly-close-ui-reconciliation

**Archived:** 2026-04-22
**Outcome:** PASS_WITH_WARNINGS (0 CRITICAL, 2 WARNING fixed, 1 SUGGESTION, 1 OBSERVATION)
**Test suite:** 2681/2681 tests passing
**Canonical promotion:** `openspec/changes/monthly-close-ui-reconciliation/specs/monthly-close-ui/spec.md` → `openspec/specs/monthly-close-ui/spec.md` (new capability)

---

## Executive summary

Reconciled the monthly-close UI around a single canonical surface (`/accounting/monthly-close`), retired the legacy modal dialog at `/settings/periods`, aligned permission gates to the `period` resource, and promoted the first real `period:write` use case. All 24 tasks complete. Verify passed with W-01 (bundled REQ-2 + REQ-3 landing on same file surface — not fixable mid-stream, documented) and W-02 (stale vi.mock residual from prior deletion — FIXED in commit `a0c4d79` pre-archive). Two Rule-6-qualifying canonical rule applications: F-08 (period-close-dialog retirement) and F-12 (PERMISSIONS_WRITE["period"] matrix extension).

---

## Final state

**Commit range:** `c099fac` (RED test for F-12) → `a0c4d79` (mock hygiene pre-archive fix)

**Test suite delta:** 2681/2681 passing (0 failures)

**Files created:** 1 canonical spec at `openspec/specs/monthly-close-ui/spec.md`

**Files modified:** 21 production files, 17 test files

**Files deleted:** 2 (`period-close-dialog.tsx`, `period-close-dialog.test.tsx`)

**Files moved:** 2 (`monthly-close-panel.tsx` + test, from `components/settings/` → `components/accounting/`)

**Retirement inventory (Rule 3 applied fresh at apply-time for each retirement):**
- F-08 dialog: 0 RESIDUAL live-code references remain (grep clean)
- REQ-6 panel move: 0 stale `components/settings/monthly-close-panel` references (grep clean)
- F-09 union member: 0 production `INSUFFICIENT_PERMISSION` references (grep clean)
- F-10 dead method: 0 callers of `updateStatus` in fiscal-periods scope (grep clean)

---

## Canonical rule applications in this change

### 63b21f9 — Rule 6 (canonical rule-application commit body)

**Rule citation:** `memory/feedback_canonical_rule_application_commit_body.md`

**Rationale:** Task F-12 extends `PERMISSIONS_WRITE["period"]` from `[]` to `["owner","admin"]`. The prior invariant was introduced in commit `5c73d55` (cierie-periodo T35, 2026-04-21) with an empty body. Neither tasks.md, design.md, nor OQ-1 of that change justified the restriction. Zero live callers of `requirePermission("period","write", ...)` existed then or now — the matrix entry was dormant. Monthly-close-ui-reconciliation M2 surfaces the first real period-write actions (create-fiscal-year, edit-OPEN-period-metadata) at `/settings/periods`, conceptually distinct from close/reopen state transitions. The empty default no longer fits. The commit body cites the origin commit, narrates the absence of justification, explains why the default is now retired (first real write surface), and names the causal chain (sdd-spec collision → operator elevation → git-log investigation → ratification of Option A).

**Cross-reference:**
- `openspec/changes/monthly-close-ui-reconciliation/proposal.md` §3.2 F-12
- `openspec/changes/monthly-close-ui-reconciliation/design.md` §4.5 (F-12 ordering)
- `openspec/changes/monthly-close-ui-reconciliation/design.md` §7.2 (commit body template)
- `openspec/changes/monthly-close-ui-reconciliation/rule-7-draft.md` (origin event that triggered Rule 7 draft)
- Commit `5c73d55` — the retired invariant's origin

**Why now:** The sdd-spec phase detected a collision between proposal AC4 (prescribing `period:write` gates for handler mutations) and the `PERMISSIONS_WRITE["period"] = []` matrix with no architectural justification. Silent resolution would have landed a cosmetic inconsistency. Operator escalation + git-log investigation confirmed the invariant was pragmatic, not canonical. Option A (extend the matrix) was ratified. This commit lands the ratification; without it, the downstream handler-gate changes would deny all roles.

---

### bdf55ce — Rule 3 (retirement re-inventory gate) + Rule 1 (RED test expected failure mode)

**Rule citation:** Rule 3 — `memory/feedback_retirement_reinventory_gate.md`; Rule 1 — implicit in project standards

**Rationale:** Task F-08 deletes `period-close-dialog.tsx` and its test (`period-close-dialog.test.tsx`), then retires the dialog from the period-list callsite by replacing the button-modal with a navigation link. The retirement inventory (fresh grep immediately before this commit) verified: 2 CONSUMER hits in `period-list.tsx` (import + usage, replaced in this commit with next/link navigation), 1 TEST-to-delete (the component's test, oq#3 resolution), 2 RESIDUAL (file-scoped declarations in the deletion target). Zero stale references remain after the commit.

The new test `components/accounting/__tests__/period-list.test.tsx:REQ-1a` asserts the row renders an `<a>` with `href="/${orgSlug}/accounting/monthly-close?periodId=<id>"`. RED fails with "expected <a> element but got <button>" because the current component renders `<Button onClick={setPeriodToClose}>`. GREEN lands in this commit when the row action becomes `<Button asChild><Link href={...}>Cerrar</Link></Button>` (or equivalent next/link pattern).

**Cross-reference:**
- `openspec/changes/monthly-close-ui-reconciliation/proposal.md` §3.1 F-08
- `openspec/changes/monthly-close-ui-reconciliation/design.md` §5.1 (testing strategy + RED failure mode)
- `openspec/changes/monthly-close-ui-reconciliation/design.md` §6.1 (retirement inventory grep)
- `openspec/changes/monthly-close-ui-reconciliation/design.md` §7.1 (Rule 3 + Rule 1 commit body template)

**Why now:** Prerequisite changes `fiscal-period-monthly-create` (archive `5d4f665`) and `apperror-details-passthrough` (archive `aa3943b`) are landed; the panel now correctly handles monthly creation and AppError.details passthrough. The blocking condition (ensuring the canonical close ritual is viable) is cleared.

---

## Warnings and observations

### W-01 — REQ-2 + REQ-3 bundled in commit `1337a36`

**Scope:** Both REQ-2 (`?periodId=` pre-selection) and REQ-3 (correlationId toast action) land on the same file surface: `components/accounting/monthly-close-panel.tsx` (post-move).

**Root cause:** The ordering invariant INV-4 and INV-5 (design.md §3.3) require both REQ-2 and REQ-3 to land AFTER the panel move (INV-3) so the panel edits happen only at the final location. The move is the first REQ-6 wiring commit. REQ-2 and REQ-3 both wire into the moved component, landing in the same commit for colocation.

**Is it a problem?** No. The bundling follows from the geometry of the task DAG and the architectural constraint (move atomicity). Design phase explicitly approved this sequencing in INV-4 + INV-5. Both REQ-2 and REQ-3 are testable independently (different test files, different assertions). Code review is unambiguous because the commit touches one component with two orthogonal changes, each with a dedicated test. A future split would have required inverse-dependency ordering (move → REQ-2 → REQ-3 as separate commits) with higher diff fragmentation and no clarity gain.

**Mitigation:** W-01 is documented. No action needed; noted for context on future similar bundling decisions.

---

### W-02 — Stale `vi.mock("../period-close-dialog")` in period-list.test.tsx (FIXED)

**What:** A test import mock for the deleted `period-close-dialog` component remained in `components/accounting/__tests__/period-list.test.tsx` after the F-08 deletion commit.

**Root cause:** The mock was part of the test file's setup block, applied globally to all tests. When F-08 deleted the component and its import, the mock declaration was inadvertently left in place (import cleaned, mock not).

**Fixed in:** Commit `a0c4d79` (`chore(tests): remove stale vi.mock for deleted period-close-dialog`) — pre-archive cleanup verified by sdd-verify. Test suite clean: 2681/2681 passing.

**Residual:** None. Pre-archive cleanup closed.

---

### OBS-01 — Pre-existing architectural gap: sidebar `resources[]` array incomplete

**Finding:** The `contabilidad` module's `resources[]` array in `components/sidebar/modules/registry.ts` does not include `"period"` (only `"dispatch"`, `"voucher"`). With the nav entry for "Cierre Mensual" now gated on `resource: "period"` (REQ-5), a user with `period:read` will see the nav item but sidebar filtering may not recognize the resource as part of the module's domain.

**Is this a blocker?** No. The sidebar visibility logic checks the user's role against the entry's resource gate independently (via `PERMISSIONS_READ["period"]`). The `resources[]` array is informational documentation of what resources the module primarily operates on, not a functional gate. The gap is a documentation/modeling inconsistency, not a runtime failure.

**Scope:** Not caused by this change. The module's `resources[]` array was incomplete before the nav entry's resource changed.

**Deferred:** Added to post-archive backlog with context for future limited-role scenario planning (e.g., if a new role is introduced with selective resource access).

---

## Operational learnings (pending codification post-archive)

Three items to codify into persistent memory (NOT codified now — reserved for post-archive refinement):

### Learning 1 — Rule 3 refinement: vi.mock declaration retirement

Rule 3 (retirement re-inventory gate) currently classifies grep hits as RESIDUAL/TEST-to-update/CONSUMER. Evidence from W-02 shows a gap: `vi.mock("<path>")` declaration retirement is distinct from bare import-statement retirement. When the deleted component is mocked globally, the mock persists after the import is removed — two separate cleanup obligations. Future Rule 3 refinement: add a check category for "vi.mock declarations that reference deleted imports" to prevent similar oversights.

### Learning 2 — Option 2 check-in refinement: mandatory-deliverable checklist

The sdd-apply phase skipped the Phase 0 checklist report (4-point set of pre-apply confirmations: RED tests written, tasks decomposed, retirement inventories scoped, mock hygiene planned). All 4 points passed cleanly, but the report was omitted. Retroactive reconstruction was low-cost but only by luck (the changes were straightforward). Future sdd-apply: deliver the Phase 0 checklist report as a mandatory artifact, not optional.

### Learning 3 — Rule 5 empirical reinforcement: low-cost verification asymmetry value

Three cases now accumulated supporting Rule 5's asymmetry principle:
1. W-01 from `apperror-details-passthrough` — bundled REQs caught + documented
2. W-02 from this change — stale mock caught pre-archive
3. OBS-01 here — pre-existing architectural gap detected via absence-testing (sidebar resources array inspection)

The low-cost checks (spec diffs, absence-detection, grep inventories) consistently surface issues that would linger post-archive. Pattern well-supported by evidence.

---

## Rule 7 (draft) — Escalation protocol for architectural invariant collisions

Rule 7 draft is captured at `openspec/changes/monthly-close-ui-reconciliation/rule-7-draft.md`. It covers "architectural invariant collision elevation" — when a proposal decision collides with an existing restrictive enum, schema constraint, or convention, the sub-agent must escalate rather than resolve silently. The draft will be formally codified into `~/.claude/projects/-home-marko2570-workspace-projects-avicont-ia-avicont-ia/memory/` AFTER archive, applying the three standard refinements established by Rule 5's codification (broader trigger, optional "why now", dual enforcement points at sdd-spec + sdd-verify).

The collision that triggered Rule 7 draft: sdd-spec sub-agent detected proposal AC4 (`period:write` gates for handlers) conflicting with `PERMISSIONS_WRITE["period"] = []`. The sub-agent silently resolved to a different gate instead of escalating. Operator investigation afterwards revealed the invariant had no architectural justification — Option A (extend the matrix, now F-12) was correct. Silent resolution cost one round-trip of verify-and-reconsider. Rule 7 codification will prevent this pattern.

---

## Post-archive deliverables (not included in this archive, scheduled for follow-up session)

1. **Codify Rule 7** into `memory/` following the three-refinement pattern (trigger scope, optional why-now field, dual enforcement at sdd-spec + sdd-verify).
2. **Refine Rule 3** to distinguish `vi.mock` declaration retirement from import-statement retirement as separate inventory obligations.
3. **Establish Option 2 convention** for mandatory Phase 0 checklist report in sdd-apply result contracts.
4. **OBS-01 backlog entry** — future-limited-role scenario planning: reconcile sidebar `resources[]` arrays with all page-level resource gates for consistency.

---

## Engagement summary

- **Change:** monthly-close-ui-reconciliation
- **Phases completed:** Proposal → Spec → Design → Tasks → Apply → Verify → Archive
- **Total commits:** 9 wiring commits (F-12 infrastructure, F-06 error-registry, F-09/F-10 cleanups, REQ-6 move, REQ-1–REQ-5 UI reconciliation) + 2 RED test commits + 1 mock-hygiene fix (pre-archive)
- **Rule applications:** Rule 1 (RED), Rule 2 (mock hygiene), Rule 3 (retirement re-inventory), Rule 4 (aspirational mock signal), Rule 5 (low-cost verification asymmetry), Rule 6 (F-08 + F-12 canonical commit bodies)
- **Final state:** All 24 tasks complete; 2681/2681 tests passing; 0 CRITICAL findings; 2 WARNING (W-01 documented, W-02 fixed); 1 SUGGESTION (import-path cleanup); 1 OBSERVATION (sidebar resource array gap — deferred backlog)

---

## Canonical spec location

The delta spec is promoted to `openspec/specs/monthly-close-ui/spec.md` — a new canonical capability documenting the consolidated monthly-close UI surface, page/nav permission gates, `?periodId` pre-selection, and correlationId entry-point contracts.
