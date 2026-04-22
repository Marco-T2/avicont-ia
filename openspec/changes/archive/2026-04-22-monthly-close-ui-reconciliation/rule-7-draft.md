# Rule 7 (draft) — Working memory for monthly-close-ui-reconciliation

**Status:** Draft. Not yet codified in persistent memory (`~/.claude/projects/-home-marko2570-workspace-projects-avicont-ia-avicont-ia/memory/`). Formal codification deferred until after this change is archived, applying the three standard refinements used for Rule 5 (broader trigger, optional "why now", dual enforcement).

## Base statement

> Architectural invariant collision elevation. When a proposal decision collides with an existing architectural invariant (restrictive enum, schema constraint, "by design" comment, established convention), the sub-agent must pause and elevate to operator decision. Do not resolve silently with the "more conservative" option. The collision itself is evidence that the invariant's applicability to the new context requires human judgment.

## Origin event

`monthly-close-ui-reconciliation` sdd-spec phase (2026-04-22). Sub-agent found that proposal AC4 prescribed `period:write` for `/settings/periods` create/edit handlers, but `PERMISSIONS_WRITE["period"] = []` in `features/shared/permissions.ts:71` with a `"period: not directly writable — use close/reopen actions instead"` inline comment. The sub-agent corrected the spec unilaterally to `accounting-config:write`. In its result contract it noted: *"No me lo elevó para decisión — tema a señalar en la metodología"*.

Operator investigation afterwards revealed:
- Commit body of the invariant's origin (`5c73d55`, T35 of `cierre-periodo`) was empty
- Neither `tasks.md`, `design.md`, nor `proposal.md` OQ-1 of that change justified the restriction
- Zero live callers of `requirePermission("period", "write", ...)` existed
- The invariant was a pragmatic default, not a canonical architectural constraint

Had the sub-agent escalated, the operator would have authorized the Option A path (extend the matrix) up front. Silent resolution cost one round-trip of verify-and-reconsider plus risk of landing a cosmetic inconsistency (Option B) in the archive.

## Why this rule is worth codifying

- **Asymmetric cost.** Escalation when no collision exists: zero activation (rule doesn't fire). Escalation when collision exists: prevents silent loss of operator decisions and surfaces invariants whose justification may be stale.
- **Operator tax is near-zero.** The sub-agent already knows it hit a collision — it detected the code contradiction. Adding "pause and report" to the detection is a few sentences in the result contract.
- **Cold-context author.** The invariant's origin commit was 24 hours old and the same author. Rule 5 protects the same developer reconstructing decisions with cooled context — this case is the canonical demonstration. Rule 7 fires upstream of that: it prevents a stale invariant from silently constraining new work without review.

## Refinements to apply at formal codification (post-archive)

Apply the pattern that worked for Rule 5:

1. **Broader trigger.** Activation is not limited to "architectural invariants explicitly labeled as such." Any of the following count:
   - Restrictive enum / union / Record type with narrowing semantics
   - Schema constraint (unique, check, FK with cascade)
   - `// by design`, `// do not`, `// intentionally` inline comments
   - Named convention surfaced in CLAUDE.md, AGENTS.md, or a spec
   - Invariant asserted by a test (e.g., `EXPECTED_WRITE.period: []`)
2. **Optional "why now" in the escalation report.** When the sub-agent elevates, include one line on why this collision is visible now (previous unrelated ticket, new surface, freshly introduced code). Saves operator time reconstructing the causal chain.
3. **Dual enforcement.**
   - **Injection point:** `sdd-spec` and `sdd-tasks` sub-agent prompts gain an "Escalation protocol" section that names collision types and the required response format.
   - **Gate point:** `sdd-verify` sub-agent prompt checks whether any spec REQ or task acceptance silently inverted an invariant — if so, flag as CRITICAL even when tests pass. Verify asks: "Does any deviation from the proposal reconcile with an invariant, and was that reconciliation explicit?"

## Cross-references (for post-archive codification)

- Commit `5c73d55` — origin of the `period: not directly writable` invariant (cierre-periodo T35)
- `openspec/changes/archive/2026-04-22-monthly-close-ui-reconciliation/ARCHIVE.md` §"Canonical rule applications" / F-12 entry — the matrix extension that retires the invariant
- Rule 6 commit body written for F-12 (commit `63b21f9`) — canonical example of what a Rule 7 escalation produces when ratified (cite → historical evidence → "why now")
- `memory/feedback_canonical_rule_application_commit_body.md` (Rule 6) — precedent for the three-refinement pattern
