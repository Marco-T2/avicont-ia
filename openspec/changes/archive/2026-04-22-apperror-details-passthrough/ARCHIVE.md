# Archive — apperror-details-passthrough

**Archived:** 2026-04-22
**Outcome:** PASS_WITH_WARNINGS → archive (W-01 commit body gap codified into new SDD convention)
**Commits:** 5 across 4 phases (T01 docs, T03 RED, T04a+T04b refactor, T04c fix, T05 mock-hygiene)
**Suite delta:** +1 test (2670 → 2671, 0 failures)

---

## Executive summary

Closed the middleware serialization gap (W-01 contradictor finding from prior `fiscal-period-monthly-create` verify pass) by:

1. **Extracting `handleError`** from `features/shared/middleware.ts` into a standalone side-effect-free module `features/shared/http-error-serializer.ts`. The extraction was required — not opportunistic — to enable strict Rule 4 compliance by allowing tests to import the real serializer without triggering `OrganizationsService` module-scope instantiation.

2. **Patching the AppError branch** to conditionally spread `error.details` into the HTTP response body. The one-liner fix (`...(error.details ? { details: error.details } : {})`) closes the gap that caused `PERIOD_HAS_DRAFT_ENTRIES`, `PERIOD_UNBALANCED`, and `LOCKED_EDIT_REQUIRES_JUSTIFICATION` details to be silently dropped before reaching HTTP consumers.

3. **Retiring the aspirational `handleError` mock** in `monthly-close/__tests__/route.test.ts` (lines 52-73). This is the **first canonical post-codification application of Rule 4** — the mock was aspirational specification for an unimplemented producer contract. With the real serializer now honoring the contract, the mock is removed and tests exercise real middleware behavior end-to-end.

4. **Canonicalizing** the error-serialization capability into `openspec/specs/error-serialization/spec.md` (REQ-1 through REQ-6). This is a new canonical spec — no prior spec for this capability existed.

Suite: 2671 tests / 0 failures. tsc 0 errors.

---

## REQ compliance snapshot

All 6 REQs PASS per sdd-verify report (PASS_WITH_WARNINGS):

- REQ-1 AppError branch conditional spread ✓
- REQ-2 Prisma.Decimal → string serialization contract ✓
- REQ-3 ZodError branch unchanged (regression guard) ✓
- REQ-4 Unknown-error branch unchanged (regression guard) ✓
- REQ-5 Structural primacy of `details` over message (consumer contract) ✓
- REQ-6 `handleError` importable without module-scope side effects ✓

---

## Phase commit summary

**Phase A (T01): Documentation**
- `(earlier commit)` docs(spec): add delta spec for error-serialization capability

**Phase B (T03): RED test**
- `687e405` test(iva-books/purchases): RED — assert body.details.requiredMin for LOCKED_EDIT_REQUIRES_JUSTIFICATION route response

**Phase C (T04a+T04b, T04c): Extraction + GREEN patch**
- `e9ac1f3` refactor(middleware): extract handleError to http-error-serializer module (T04a + T04b combined — re-export backward-compat strategy applied, 50+ callers from middleware re-export)
- `2881cb2` fix(http-error-serializer): spread AppError.details into HTTP response body when defined

**Phase D (T05): Mock hygiene**
- `0d1842a` test(mock-hygiene): retire aspirational handleError mock from monthly-close route test; align iva-books/purchases/[id] mock with real middleware

---

## Verify warnings and suggestions (PASS_WITH_WARNINGS)

**W-01 — T05 commit body empty (non-blocking)**

Commit `0d1842a` has an empty body. The subject line names the mock hygiene action per Project Standard 2, but the body with Rule 4 rationale is absent. Root cause: this was the first native application of the `canonical-rule-application-commit-body` SDD convention — the convention was codified during this change's verify phase, creating a chicken-and-egg situation. The archive `## Canonical rule applications in this change` section (below) serves as the durable reference for future devs reaching this commit via `git blame`. The W-01 gap has been codified into a new SDD convention for all future rule-application commits.

**S-01 — 50+ production route consumers import `handleError` via `@/features/shared/middleware` re-export**

Architectural separation between error serialization and auth middleware is invisible from import paths. Future cleanup could migrate high-traffic consumers to `@/features/shared/http-error-serializer` directly. Residual technical debt from the backward-compat re-export choice.

**S-02 — T03 `LOCKED_EDIT_REQUIRES_JUSTIFICATION` test uses accurate-proxy mock, not live import**

The purchases route test retains its proxy mock alignment per T05 spec. Strict Rule 4 compliance for that specific test file is a future candidate.

**S-03 — No contract test between proxy mock and real serializer**

No contract test currently alerts if the accurate-proxy mock in `iva-books/purchases/[id]/__tests__/route.test.ts` diverges from the real `http-error-serializer.ts` behavior. Low-priority: add contract test between proxy mock and real serializer.

---

## Canonical rule applications in this change

### 0d1842a — Rule 4 (aspirational mocks = unimplemented contracts)

**Rule citation:** Rule 4 — `memory/feedback_aspirational_mock_signals_unimplemented_contract.md`

**Rationale:** The `vi.mock` block in `monthly-close/__tests__/route.test.ts:52-73` was a total replacement of `handleError` that spread `e.details` as aspirational specification. The real middleware never honored that contract. With `http-error-serializer.ts` now correctly spreading `AppError.details`, the mock is retired — tests now exercise the real serialization pipeline end-to-end.

**Cross-reference:** `proposal.md` §10, `specs/error-serialization/spec.md` REQ-5

**Why now:** Detected via the verify contradictor sweep of the prior change `fiscal-period-monthly-create`. W-01 warning in that verify surfaced the aspirational mock pattern that Rule 4 codifies. This change is therefore the first canonical post-codification application of Rule 4.

---

## Backlog (future work — not blocking this change)

### From verify report

**S-01 — Architectural import path cleanup (low priority)**

All 50+ production route consumers still import `handleError` from `@/features/shared/middleware` (via re-export). Architectural separation between error serialization and auth middleware is invisible from import paths. Future cleanup could migrate high-traffic consumers to `@/features/shared/http-error-serializer` directly. Residual technical debt from the backward-compat re-export choice.

**S-02 — Strict Rule 4 compliance for purchases route test (low priority)**

T03 `LOCKED_EDIT_REQUIRES_JUSTIFICATION` test exercises the real serialization contract via an accurate-proxy mock, not via live import of `http-error-serializer.ts`. The purchases route test retains its proxy alignment per T05 spec. Strict Rule 4 compliance for that specific test file is a future candidate, not a current gap.

**S-03 — Contract test between proxy mock and real serializer (low priority)**

No contract test currently alerts if the accurate-proxy mock in `iva-books/purchases/[id]/__tests__/route.test.ts` diverges from the real `http-error-serializer.ts` behavior. Low-priority backlog: add contract test between proxy mock and real serializer.

### From session-level operational observations

**Suite flaky DB-heavy tests**

Apply phase reported pre-existing timeout flakes in DB-heavy repository tests, resolved by re-run. Each future apply deals with the same friction. Audit and stabilize that portion of the suite before the next high-volume apply phase.

**RED failure mode prediction pattern (third instance)**

Third instance this session of observing `TypeError: Cannot read properties of undefined (reading 'X')` where the tasks.md spec predicted `AssertionError: expected undefined to be Y`. Both forms prove the same invariant from different layers. Future RED task specs should declare failure mode as "TypeError OR AssertionError on `body.X.Y`" — both are acceptable as long as the invariant is unambiguously falsified.

**Pre-existing git stash**

A stash exists on this working tree from before this session. Confirm intentional content before any destructive git operation that could interact with stashes.

---

## Unblocks

This archive unblocks **`monthly-close-ui-reconciliation`** — the UI change that expects to read `error.details` from the monthly-close POST endpoint. The panel at `components/settings/monthly-close-panel.tsx` currently refetches `/summary` as a workaround for the serialization gap. With `details` now serialized correctly, the panel can consume `error.details` directly and drop the refetch. That refactor is owned by `monthly-close-ui-reconciliation`.

---

## Engram references

- `sdd/apperror-details-passthrough/proposal` — original proposal
- `sdd/apperror-details-passthrough/spec` — REQ set (6 REQs)
- `sdd/apperror-details-passthrough/design` — architecture decisions (extraction, conditional spread, Decimal contract)
- `sdd/apperror-details-passthrough/tasks` — 11-task breakdown (T01–T09 with T04a/T04b split)
- `sdd/apperror-details-passthrough/archive-report` — this archive entry

## Related canonical specs

- `openspec/specs/error-serialization/spec.md` — NEW: first canonicalization of this capability (REQ-1..REQ-6)
- `openspec/specs/monthly-period-close/spec.md` REQ-4 — mandated the structured details shape; this change makes the runtime deliver it
