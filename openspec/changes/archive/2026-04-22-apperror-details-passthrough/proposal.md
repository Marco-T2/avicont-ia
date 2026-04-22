# Proposal: apperror-details-passthrough

**Change name:** `apperror-details-passthrough`
**Date:** 2026-04-22
**Phase:** Proposal
**Origin:** W-01 contradictor finding in `sdd-verify` of archived change `fiscal-period-monthly-create` (2026-04-22).

---

## 1. Problem

During `sdd-verify` of `fiscal-period-monthly-create` (2026-04-22), finding **W-01** surfaced a silent divergence between the canonical spec and the runtime serialization layer:

- **Current middleware behavior** — `features/shared/middleware.ts handleError` serializes `AppError` instances as `{ error: error.message, code: error.code }`. The `error.details` field is dropped on the floor before the HTTP response leaves the server.
- **Canonical spec mandate** — `openspec/specs/monthly-period-close/spec.md` REQ-4 requires `PERIOD_HAS_DRAFT_ENTRIES` responses to carry per-entity draft counts (`dispatches`, `payments`, `journalEntries`, `sales`, `purchases`). The service at `features/monthly-close/monthly-close.service.ts:166` emits these correctly; the middleware discards them.
- **Test-side masking** — Route tests at `app/api/organizations/[orgSlug]/monthly-close/__tests__/route.test.ts:65-67` mock `handleError` with an aspirational implementation that spreads `e.details`. Because the test mock honors the contract the real middleware violates, the gap is invisible from the test suite's perspective. The same mock also covers the `PERIOD_UNBALANCED.details` assertion at `:166-184`.
- **Detection mechanism** — This is a textbook invocation of **Project Standard 4 (aspirational mocks signal unimplemented contract)**. The aspirational `handleError` mock is the canonical signal that the real middleware has not caught up to the spec. W-01 was found precisely because the verify phase applied that rule.

The exploration (`openspec/changes/apperror-details-passthrough/exploration.md`) audited all three `AppError` codes that carry `details` in the current codebase (`PERIOD_HAS_DRAFT_ENTRIES`, `PERIOD_UNBALANCED`, `LOCKED_EDIT_REQUIRES_JUSTIFICATION`) and classified all three as **SAFE-FIX** with **zero real production consumers** of `.details` from the HTTP response. The fix is a one-line spread in the `AppError` branch of `handleError`.

---

## 2. Goal

Close the middleware serialization gap so that `AppError.details`, when present, reaches HTTP consumers — bringing the runtime into alignment with canonical specs that already mandate the structured field.

---

## 3. Scope (IN)

1. **`handleError` extraction** — `handleError` and its ZodError/AppError/unknown branches are extracted from `features/shared/middleware.ts` into a standalone module (`features/shared/http-error-serializer.ts` or similar) with zero module-scope side effects. This is scope expansion beyond the original one-liner — see §10 for explicit justification. The old `handleError` export from `middleware.ts` is either re-exported for backward compatibility or removed if caller audit finds no dependents on that import path.
2. **Serializer patch** — The `handleError` AppError branch in the new standalone module spreads `error.details` into the response body when defined; emits nothing for that key when `undefined`. Does not touch the `ZodError` or unknown-error branches.
3. **Spec text for Decimal→string serialization contract (D1)** — The new delta spec written in the next phase (`openspec/changes/apperror-details-passthrough/specs/.../spec.md`) MUST declare that `PERIOD_UNBALANCED.details.debit`, `.credit`, and `.diff` serialize as strings in the HTTP body via `Prisma.Decimal.toJSON()`. This documents the non-JSON-native serialization contract for downstream consumers.
4. **Route-level RED test for `LOCKED_EDIT_REQUIRES_JUSTIFICATION.details.requiredMin` (D3)** — At least one representative route endpoint that exercises `validateLockedEdit` (candidates per exploration §3: documents, purchases, sales, dispatch, payment, journal) gets a RED test asserting `body.details.requiredMin` on the HTTP response. The exact endpoint is deferred to `sdd-tasks`. This locks the structured contract and pre-positions future i18n/consumers that need the number without string-parsing the human-readable message.
5. **Mock retirement tasks (D2 / AC2)** — The aspirational mock at `monthly-close/__tests__/route.test.ts:52-73` that spreads `e.details` is named explicitly as a retirement target in `sdd-tasks`. The mock retirement task (T05) removes or replaces the aspirational mock with an accurate proxy-of-real. Making this explicit documents the canonical application of Project Standard 4 and preserves the learning in the ARCHIVE.
6. **Regression gate** — Full test suite passes post-fix.

---

## 4. Scope (OUT)

- **UI refactor of `components/settings/monthly-close-panel.tsx` (D5)** — The panel currently refetches `/summary` after a close error (workaround for W-01). Once middleware passes `details`, the panel could consume `error.details` directly and skip the refetch. That refactor belongs to the paused change **`monthly-close-ui-reconciliation`**, which is the follow-up owner. This change is transversal (any `AppError` with `details`); the UI consumer refactor is specific to one component. Mixing them dilutes scope.
- **`ZodError` branch of `handleError`** — Already correct (`{ error, details: error.flatten() }`). Zero change. This branch is the existing production path for `company-profile-form.tsx` and must remain stable.
- **Unknown-error branch of `handleError`** — Already correct. Returns `{ error: "Error interno del servidor" }`. No `details` to pass; out of scope.
- **Canonical spec `openspec/specs/monthly-period-close/spec.md` (D4)** — UNTOUCHED. REQ-4 text already says what it should. The code is catching up to the spec, not the other way around. Canonical specs are present-tense contracts; ARCHIVE docs are cronología. No historical annotation added. The change-specific REQ lives only in the new delta spec for this change.
- **Retiring any `AppError` subclass** — Audit confirmed no dead `AppError` subclass. The Project Standard 3 (retirement re-inventory gate) is **N/A** for this change.
- **Adding new `AppError` subclasses or new `details` shapes** — Outside the bug-fix scope.

---

## 5. Acceptance criteria

| ID | Criterion |
|---|---|
| **AC1** | The `handleError` function (post-extraction: in `features/shared/http-error-serializer.ts`) AppError branch emits `details` in the HTTP body when `error.details` is defined; emits no `details` key when `error.details` is `undefined`. |
| **AC2** | **Mock retirement for aspirational `handleError` in `monthly-close` route tests.** State today: the assertions at `app/api/organizations/[orgSlug]/monthly-close/__tests__/route.test.ts:65-67` (5 keys for `PERIOD_HAS_DRAFT_ENTRIES.details`) and `:166-184` (3 Decimal-as-string keys for `PERIOD_UNBALANCED.details`) **pass today via an aspirational mock** (`vi.mock("@/features/shared/middleware", ...)` at lines 52-73 spreads `e.details`). The real middleware at `middleware.ts:39-43` does NOT spread `details` — the mock masks the gap. Work required: T04 (or T04c after extraction) patches the real serializer to spread `details`; T05 retires the aspirational mock (removes it, or replaces it with an accurate proxy-of-real if module-scope side effects block full removal). Outcome: the same `expect(body.details).toMatchObject({...})` assertions now exercise **real middleware behavior**; the mock's aspirational specification is resolved as a live contract. Failure mode for verification: if the mock is removed AND the middleware is NOT patched, both test suites fail with `AssertionError: expected undefined to match object { ... }` on `body.details` — this is the latent RED that existed behind the aspiration, now made explicit. **The real work in this change is mock retirement, not an automatic flip.** |
| **AC3** | At least one route-level RED test asserts `body.details.requiredMin` on a `LOCKED_EDIT_REQUIRES_JUSTIFICATION` HTTP response and flips GREEN when the middleware patch lands. Failure mode at RED: `expect(body.details.requiredMin).toBe(<n>)` assertion failure because `body.details` is `undefined`. |
| **AC4** | The new delta spec declares the `Prisma.Decimal`→string serialization contract for `PERIOD_UNBALANCED.details.debit`, `.credit`, and `.diff`. |
| **AC5** | `ZodError` branch behavior unchanged. Regression guard: any existing test that exercises the ZodError path (`company-profile-form.tsx` flow) passes unmodified. |
| **AC6** | Non-`AppError` throw paths (plain `Error`, Prisma errors, `TypeError`, etc.) serialization unchanged — they continue to return `{ error: "Error interno del servidor" }` with no `details` key. |
| **AC7** | **No aspirational mock remains** for `handleError` serialization: the real middleware now honors the contract the tests assert. Explicit invocation of Project Standard 4 — detected by W-01, resolved by this change. |
| **AC8** | Full test suite green post-fix. Test-count delta ≥ **+1** (for AC3's new RED test at minimum). |
| **AC9** | `handleError` is extracted to a standalone module (suggested path: `features/shared/http-error-serializer.ts`) with **zero module-scope side effects** — no top-level `new`, no top-level `auth()` calls, no top-level DB/Prisma imports that execute at module load. This allows a test to import the real serializer directly without triggering `OrganizationsService` or Clerk initialization, unblocking strict full-mock removal (AC7). `middleware.ts` either re-exports `handleError` from the new module for backward compatibility, or all callers are updated to import from the new path — audit at apply time. |

---

## 6. Risks & mitigations

| ID | Risk | Likelihood | Mitigation |
|---|---|---|---|
| **R1** | `ZodError` branch regression caused by middleware refactor. | Low | AC5 regression guard; keep diff scoped to the `AppError` branch only — do not touch the `ZodError` or unknown branches. |
| **R2** | Non-`AppError` throw path (plain `Error`, Prisma errors) regression. | Low | AC6 regression guard; the fix is a conditional spread inside the `AppError` branch, other paths are untouched. |
| **R3** | `Prisma.Decimal` serialization surprise in `PERIOD_UNBALANCED.details`. | Negligible | D1 → AC4: spec text makes the `Decimal.toJSON() → string` contract explicit. Existing tests already assume string form (`"10000.00"`, `"9500.00"`, `"500.00"`), so the runtime behavior is already what consumers expect. |
| **R4** | `handleError` extraction may require updating callers of `middleware.ts` that import `handleError` from that path. | Low | Audit callers at apply time. If callers are ≤5, update all to import from the new module path. If >5, re-export from `middleware.ts` for zero caller change. Identifying all import paths and verifying no circular dependencies has low but non-zero risk. |

---

## 7. Open questions (for `sdd-tasks` phase)

1. **AC3 route choice** — Which specific route(s) to cover for `LOCKED_EDIT_REQUIRES_JUSTIFICATION.details.requiredMin`? Candidates per exploration §3: documents, purchases, sales, dispatch, payment, journal. `sdd-tasks` selects based on test ergonomics (likely payments or documents, per the exploration's reference to `features/payment/__tests__/payment.service.locked-edit.test.ts`). A single representative route is sufficient for AC3; additional routes can be tightened opportunistically.
2. **Extraction module location** — Suggested path is `features/shared/http-error-serializer.ts`. Design phase may select a different name if naming conventions in the project favor it (e.g., `features/shared/error-serializer.ts`). Deferred to design/apply. The constraint is zero module-scope side effects — name is secondary.
3. **Commit boundary strategy** — Anticipate 4–6 commits after extraction:
   - `refactor(middleware)`: extract `handleError` to standalone module (T04a); update backward-compat re-export in `middleware.ts` (T04b).
   - `test(...)`: RED route test for AC3 (T03).
   - `fix(http-error-serializer)`: patch the AppError branch spread in the new module (T04c).
   - `test(mock-hygiene)`: retire aspirational mock (T05).
   - `docs(spec)`: new delta spec with AC4 Decimal contract (if not pre-committed).
   Per **Project Standard 2**: any mock-hygiene action MUST be named in the commit message or shipped as a preceding commit, never buried in wiring diffs. `sdd-tasks` finalizes the boundary.

---

## 8. Follow-ups this proposal enables

- **`monthly-close-ui-reconciliation`** — Paused change, blocked on this one landing. Once middleware passes `details`, `monthly-close-panel.tsx` can consume `error.details` directly and drop the `/summary` refetch workaround. That refactor is owned by `monthly-close-ui-reconciliation`, not this change (D5).

---

## 9. Project Standards invoked

- **#1 RED acceptance failure mode** — AC2 and AC3 declare explicit failure modes (`expect(...).toMatchObject` / `.toBe` assertion failures because `body.details` is dropped today). `sdd-tasks` RED tasks MUST preserve this specificity; no bare "FAILS" acceptances.
- **#2 Mock hygiene commit scope** — Apply-phase constraint: if any mock default adjustment is required, it must be named in the commit message or shipped as a preceding commit.
- **#3 Retirement re-inventory gate** — **N/A** (no retirement in this change).
- **#4 Aspirational mocks signal unimplemented contract** — Problem framing (§1) cites this rule as the detection mechanism for W-01; AC7 is the explicit resolution criterion. The `handleError` **extraction** (§10) is what enables STRICT compliance with this rule: without extraction, the module-scope side effect in `middleware.ts:9` blocks full `vi.mock` removal, leaving the project at "80% Rule 4 compliance" (accurate proxy, not live import). The extraction is not an opportunistic cohesion improvement — it is the enabling change for AC7 strict compliance.
- **#5 Low-cost verification asymmetry** — Noted as apply/verify-phase constraint: the serializer fix is a one-liner once extracted; the verification cost (run the existing aspirational assertions + one new RED test) is disproportionately low and should be honored.

---

## 10. Scope expansion justification — module extraction

### What this section is

This section documents WHY the extraction of `handleError` into `features/shared/http-error-serializer.ts` is accepted as scope expansion for this change. It is written with explicit precision to prevent future changes from citing this precedent incorrectly.

### The expansion

Extracting `handleError` from `middleware.ts` into a standalone module is **scope expansion beyond the original one-liner**. The original change was: "spread `error.details` in the `AppError` branch of `handleError`." The extraction adds ~2 additional tasks (move the function, update the import in `middleware.ts`, audit other callers). This is intentional.

### The ONLY justifying reason: strict compliance with Project Standard 4

The justifying reason is **strict compliance with Project Standard 4** (Aspirational mocks signal unimplemented contract), not opportunistic improvement.

The causal chain:
1. AC7 mandates: "no aspirational mock remains for `handleError` serialization."
2. Strict AC7 requires removing the `vi.mock("@/features/shared/middleware", ...)` mock entirely and importing the real serializer.
3. `middleware.ts:9` instantiates `OrganizationsService` at module scope: `const orgsService = new OrganizationsService()`. Importing the real `middleware.ts` in a test environment pulls `OrganizationsService` → `Prisma` → breaks the test env.
4. Without extraction, the only path to AC7 compliance is a "proxy mock mirroring real behavior" — which is 80% of Rule 4, not strict. The aspirational mock becomes an accurate-proxy mock, but NOT a live import.
5. This change is the **first canonical application of Rule 4 post-codification**. A 80%-compliance precedent here weakens the rule's meaning for all future applications. The extraction resolves this at the cost of ~2 tasks.

The user's direct rationale (preserved verbatim):

> "The archive must honestly document the mechanism. If AC2 describes an automatic flip that did not occur, future developers using this change as the reference for Rule 4 will internalize a mechanism that never happened. Rule 4 says 'aspirational mock = unimplemented contract, convert into live contract' — AC2 must capture that the real work is mock retirement, not flip automation. This is the first canonical application of Rule 4 post-codification; pedagogical purity matters."

### Explicit rejection of alternative motivations

**Cohesion improvement is NOT a justifying reason.** It is true that auth/session concerns (`requireAuth`, `requireOrgAccess`, `requireRole`) and HTTP error serialization (`handleError`) are separate concerns and arguably belong in separate modules. This cohesion observation is a secondary benefit of the extraction. It is **NOT the reason this extraction is accepted**. Future changes MUST NOT cite "cohesion opportunity" as motivation for scope expansion using this change as precedent.

**Mechanical simplicity is NOT a justifying reason.** "Move function + update imports is mechanical" is oversold as justification. Identifying all callers of `handleError` from `middleware.ts`, verifying no circular dependency patterns arise after extraction, and ensuring all dependent tests remain functional has low but non-zero risk. The extraction is accepted despite this cost — not because the cost is negligible.

### Time-box constraint

The extraction is ~2 additional tasks: (T04a) move `handleError` and its ZodError/AppError/unknown branches to the new module; (T04b) update `middleware.ts` with a backward-compat re-export or remove if no callers. Anything beyond this scope (e.g., extracting other helpers, restructuring `middleware.ts` further) is **orchestrator escalation material** and must NOT proceed autonomously at apply time.
