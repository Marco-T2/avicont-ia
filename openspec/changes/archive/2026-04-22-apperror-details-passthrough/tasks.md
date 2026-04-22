# Tasks: apperror-details-passthrough

**Change:** `apperror-details-passthrough`
**Date:** 2026-04-22
**Phase:** Tasks
**Estimated commits:** 5–7

> **RED-OBS (RED-OBSERVATIONAL)** is a task kind used for empirical observation of a failure mode without committing any change. Local convention for this change; codify in official flow documentation if it recurs across future SDD changes.

---

## Dependency graph

```
T01 (DOCS — pre-satisfied)
  ├─> T02 (RED-OBS)
  └─> T03 (RED)
        └─> T04a (REFACTOR: extract handleError)
              └─> T04b (CHORE: backward-compat re-export or caller update)
                    └─> T04c (GREEN: patch AppError branch in new module)
                          └─> T05 (CHORE: mock hygiene — retire aspirational mock)
                                ├─> T06 (REGRESSION-GATE: ZodError)
                                ├─> T07 (REGRESSION-GATE: unknown-error)
                                └─> T08 (FINAL-GATE)
                                      └─> T09 (VERIFY: no aspirational mock)
```

All RED tasks must complete before extraction (T04a). T04a/T04b must complete before GREEN patch (T04c). All REGRESSION-GATE tasks run after mock hygiene (T05). FINAL-GATE and VERIFY are the last steps.

---

## Phase A — Documentation (pre-satisfied)

### T01 — Write delta spec for `error-serialization` capability

| Field | Value |
|---|---|
| **ID** | T01 |
| **Title** | Write delta spec: `error-serialization` capability |
| **Kind** | DOCS |
| **Status** | DONE (completed in sdd-ff Phase 1) |
| **Files touched** | `openspec/changes/apperror-details-passthrough/specs/error-serialization/spec.md` (created) |
| **Preconditions** | None |

**Acceptance criteria:**
- Spec file exists at `openspec/changes/apperror-details-passthrough/specs/error-serialization/spec.md`.
- Contains REQ-1 through REQ-6 (REQ-6 added in D7 refinement: testability — `handleError` must be importable without module-scope side effects).
- Does NOT modify any file under `openspec/specs/`.

**Commit:** `docs(spec): add delta spec for error-serialization capability`

---

## Phase B — RED observation and RED test

### T02 — Observe latent RED baseline for aspirational mock assertions

| Field | Value |
|---|---|
| **ID** | T02 |
| **Title** | RED-OBS: observe true latent RED — PERIOD_HAS_DRAFT_ENTRIES and PERIOD_UNBALANCED without mock spread |
| **Kind** | RED-OBS (observation only — no test file modification committed) |
| **Files touched** | `app/api/organizations/[orgSlug]/monthly-close/__tests__/route.test.ts` (read-only; temporary local edit to observe, NOT committed) |
| **Preconditions** | T01 |

**Context (AC2 narrative):** The assertions at `route.test.ts:65-67` (PERIOD_HAS_DRAFT_ENTRIES, 5 keys) and `:166-184` (PERIOD_UNBALANCED, 3 keys) are **currently GREEN via an aspirational mock** — the mock at lines 52-73 spreads `e.details`. The real middleware does NOT spread. This task surfaces the TRUE latent RED that exists behind the aspiration, so that the apply-progress artifact records the mechanism honestly. The tests are green today because the mock masks the gap, not because the middleware is correct.

**Instructions:**
1. Temporarily strip the aspirational spread from the mock's AppError branch at line ~67 of `monthly-close/__tests__/route.test.ts` (remove `...(e.details ? { details: e.details } : {})`), reducing that branch to `return Response.json({ error: e.message, code: e.code }, { status: e.statusCode })`.
2. Run only the two targeted tests:
   - `"(c) returns 422 PERIOD_UNBALANCED with details"` (line ~166)
   - `"(d) returns 422 PERIOD_HAS_DRAFT_ENTRIES with details"` (line ~187)
3. Record the observed failure mode verbatim.
4. Restore the file to its original state. Do NOT commit the temporary edit.

**Expected latent RED failure mode:**
```
AssertionError: expected undefined to match object {
  dispatches: 2,
  payments: 1,
}
```
(For PERIOD_HAS_DRAFT_ENTRIES — `body.details` is `undefined` when the mock no longer spreads it.)

```
AssertionError: expected undefined to match object {
  debit: "10000.00",
  credit: "9500.00",
  diff: "500.00",
}
```
(For PERIOD_UNBALANCED — same cause.)

**Acceptance criteria:**
- Observation confirms both assertions fail with the exact pattern `expected undefined to match object { ... }` for `body.details`.
- File is restored to original state before this task is marked complete.
- Observed failure modes are recorded in apply-progress artifact.
- This observation documents that the mock's aspirational specification was an unimplemented contract — the true contract becomes live after T04c + T05.

**Commit:** None — observation only.

---

### T03 — Add RED route test for `LOCKED_EDIT_REQUIRES_JUSTIFICATION.details.requiredMin`

| Field | Value |
|---|---|
| **ID** | T03 |
| **Title** | RED: add route-level test asserting `body.details.requiredMin` for LOCKED_EDIT_REQUIRES_JUSTIFICATION |
| **Kind** | RED |
| **Files touched** | `app/api/organizations/[orgSlug]/iva-books/purchases/[id]/__tests__/route.test.ts` |
| **Preconditions** | T01 |

**Instructions:**
Add a new `it` block inside the existing `describe("PATCH /api/organizations/[orgSlug]/iva-books/purchases/[id]", ...)` suite:

```typescript
it("retorna 422 LOCKED_EDIT_REQUIRES_JUSTIFICATION con details.requiredMin cuando justificación es insuficiente", async () => {
  mockServiceInstance.updatePurchase.mockRejectedValue(
    new ValidationError(
      "Se requiere una justificación de al menos 50 caracteres para modificar un documento bloqueado en un período cerrado",
      LOCKED_EDIT_REQUIRES_JUSTIFICATION,
      { requiredMin: 50 },
    ),
  );

  const { PATCH } = await import("../route");
  const request = new Request(
    `http://localhost/api/organizations/${ORG_SLUG}/iva-books/purchases/${ENTRY_ID}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ razonSocial: "Actualización", justification: "corta" }),
    },
  );
  const res = await PATCH(request, {
    params: Promise.resolve({ orgSlug: ORG_SLUG, id: ENTRY_ID }),
  });

  expect(res.status).toBe(422);
  const body = await res.json();
  expect(body.code).toBe(LOCKED_EDIT_REQUIRES_JUSTIFICATION);
  expect(body.details.requiredMin).toBe(50);
});
```

Required imports to add (if not already present):
- `ValidationError, LOCKED_EDIT_REQUIRES_JUSTIFICATION` from `@/features/shared/errors`

**RED failure mode (before middleware patch — T04):**
```
AssertionError: expected body.details.requiredMin to be 50 but received undefined
```
because `body.details` is `undefined` — the current `handleError` mock in this file (line 24-30) serializes AppError as `{ error: e.message, code: e.code }` without spreading `details`.

**Acceptance criteria:**
- Test file compiles without TypeScript errors.
- When run (before T04), the new test FAILS with:
  `TypeError: Cannot read properties of undefined (reading 'requiredMin')` OR
  `AssertionError: expected undefined to be 50` (exact message depends on Vitest version and whether `body.details` is `undefined` — either form is acceptable as long as it unambiguously fails because `body.details` is absent).
- Status code assertion (`expect(res.status).toBe(422)`) PASSES (the mock correctly returns 422 for `statusCode: 422`).
- The new test is the ONLY change in this task.

**Commit:** `test(iva-books/purchases): RED — assert body.details.requiredMin for LOCKED_EDIT_REQUIRES_JUSTIFICATION route response`

---

## Phase C — Extraction + GREEN patch

### T04a — Extract `handleError` to standalone module

| Field | Value |
|---|---|
| **ID** | T04a |
| **Title** | REFACTOR: extract `handleError` to `features/shared/http-error-serializer.ts` |
| **Kind** | REFACTOR |
| **Files touched** | `features/shared/http-error-serializer.ts` (created), `features/shared/middleware.ts` (handleError removed, re-export or callers updated in T04b) |
| **Preconditions** | T02 (baseline observed), T03 (RED test committed and failing) |

**Instructions:**
1. Create `features/shared/http-error-serializer.ts`. Move the entire `handleError` function (all three branches: AppError, ZodError, unknown) from `middleware.ts` into the new file.
2. The new module MUST satisfy ALL of these side-effect constraints:
   - Zero top-level `new` expressions
   - Zero top-level calls to `auth()`, `currentUser()`, or any Clerk function
   - Zero top-level Prisma client instantiation
   - Zero top-level imports that themselves trigger any of the above at module load
3. In `middleware.ts`, remove the `handleError` function body. See T04b for the backward-compat strategy.
4. Do NOT apply the AppError spread fix yet — this task is extraction only. `handleError` behavior is unchanged.

**Verification after extraction (before committing):**
```
pnpm vitest run features/shared/
pnpm vitest run app/api/organizations/\[orgSlug\]/monthly-close/
pnpm vitest run app/api/organizations/\[orgSlug\]/iva-books/purchases/\[id\]/
```
All tests must pass. T03's test remains RED (the fix has not been applied). This is correct.

**Acceptance criteria:**
- `features/shared/http-error-serializer.ts` exists and exports `handleError`.
- Zero module-scope side effects in the new file (confirmed by inspection).
- `middleware.ts` no longer contains the `handleError` function body.
- All existing tests pass (no behavioral change from extraction alone).
- TypeScript compiles without errors.

**Commit:** `refactor(middleware): extract handleError to http-error-serializer module`

---

### T04b — Update `middleware.ts` backward-compat re-export (or audit and update callers)

| Field | Value |
|---|---|
| **ID** | T04b |
| **Title** | CHORE: backward-compat re-export or caller update for `handleError` in `middleware.ts` |
| **Kind** | CHORE |
| **Files touched** | `features/shared/middleware.ts` (re-export line added OR callers updated) |
| **Preconditions** | T04a |

**Instructions:**
1. Audit callers: `grep -rn "handleError" app/ features/ --include="*.ts" --include="*.tsx"`. Count unique import-source sites that import from `@/features/shared/middleware`.
2. If callers ≤ 5: update each to `import { handleError } from "@/features/shared/http-error-serializer"`. No re-export in `middleware.ts`.
3. If callers > 5: add a single re-export line to `middleware.ts`:
   ```typescript
   export { handleError } from "./http-error-serializer";
   ```
   This is zero-caller-change and backward compatible.

**Acceptance criteria:**
- All callers of `handleError` resolve to the new module (either directly or via re-export).
- No import errors at TypeScript compile time.
- All tests pass.

**Commit:** Either included with T04a if re-export is the trivial one-liner, OR a separate commit `chore(middleware): add handleError re-export for backward compatibility` if non-trivial caller updates are required.

---

### T04c — Patch AppError branch in `http-error-serializer.ts` to spread `details`

| Field | Value |
|---|---|
| **ID** | T04c |
| **Title** | GREEN: patch `handleError` AppError branch in `http-error-serializer.ts` — spread `error.details` conditionally |
| **Kind** | GREEN |
| **Files touched** | `features/shared/http-error-serializer.ts` |
| **Preconditions** | T04a, T04b |

**Exact change** — in `features/shared/http-error-serializer.ts`, replace:

```typescript
  if (error instanceof AppError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.statusCode },
    );
  }
```

with:

```typescript
  if (error instanceof AppError) {
    return Response.json(
      {
        error: error.message,
        code: error.code,
        ...(error.details ? { details: error.details } : {}),
      },
      { status: error.statusCode },
    );
  }
```

No other lines in `http-error-serializer.ts` are touched. The `ZodError` branch and the unknown-error branch remain exactly as-is.

**Verification after patch (before committing):**
```
pnpm vitest run features/shared/
pnpm vitest run app/api/organizations/\[orgSlug\]/iva-books/purchases/\[id\]/
```
Confirm T03's new test NOW PASSES. Then:
```
pnpm vitest run app/api/organizations/\[orgSlug\]/monthly-close/
```
Confirm tests (c) and (d) still pass (they were passing via aspirational mock; they must remain passing).

**Acceptance criteria:**
- `features/shared/http-error-serializer.ts` diff is exactly the 3-line spread addition inside the `AppError` branch.
- T03's new RED test flips to GREEN (no test file changes).
- All other tests in the monthly-close suite pass (still via aspirational mock — that is correct at this step).
- No TypeScript compiler errors.

**Commit:** `fix(http-error-serializer): spread AppError.details into HTTP response body when defined`

---

## Phase D — Mock hygiene (Project Standard 2)

### T05 — Retire aspirational `handleError` mock (mock hygiene)

| Field | Value |
|---|---|
| **ID** | T05 |
| **Title** | CHORE (mock hygiene): retire aspirational handleError mock from monthly-close route test; align iva-books/purchases/[id] mock with real behavior |
| **Kind** | CHORE |
| **Files touched** | `app/api/organizations/[orgSlug]/monthly-close/__tests__/route.test.ts`, `app/api/organizations/[orgSlug]/iva-books/purchases/[id]/__tests__/route.test.ts` |
| **Preconditions** | T04c |

**Instructions:**

**File 1 — `monthly-close/__tests__/route.test.ts` (PREFERRED: strict removal):**
With the extraction complete (T04a), `http-error-serializer.ts` has zero module-scope side effects. The `vi.mock("@/features/shared/middleware", ...)` block (lines 52-73) that spreads `e.details` MUST be removed entirely. Replace it with a direct import of the real serializer:
```typescript
import { handleError } from "@/features/shared/http-error-serializer";
```
If `middleware.ts` is still imported for other reasons in this test file (e.g., `requireAuth`, `requireOrgAccess`), those mocks remain. Only the `handleError` mock within the block is retired.

**Fallback (only if import chain still breaks):** If removing the mock causes unexpected module resolution failures (e.g., a transitive import from `http-error-serializer.ts` that was not anticipated), fall back to an accurate proxy mock that matches real behavior exactly. Name this fallback explicitly in the commit message per Project Standard 2.

**File 2 — `iva-books/purchases/[id]/__tests__/route.test.ts`:**
The `handleError` mock (lines 12-33) currently serializes AppError WITHOUT spreading `details`. Update the AppError branch to spread `details`:

```typescript
// Before
const e = err as { message: string; code?: string; statusCode: number };
return Response.json({ error: e.message, code: e.code }, { status: e.statusCode });

// After
const e = err as { message: string; code?: string; statusCode: number; details?: Record<string, unknown> };
return Response.json(
  { error: e.message, code: e.code, ...(e.details ? { details: e.details } : {}) },
  { status: e.statusCode },
);
```

This makes the mock in this file an accurate proxy for the now-fixed real serializer, and ensures T03's test (which asserts `body.details.requiredMin`) passes.

**Project Standard 2 compliance:** the commit message for this task MUST explicitly name the mock hygiene actions. It MUST be a separate commit from T04c (the serializer patch). It MUST NOT be buried in T04c's diff.

**Acceptance criteria:**
- T03's assertion `expect(body.details.requiredMin).toBe(50)` passes.
- The aspirational `vi.mock("@/features/shared/middleware", ...)` block in `monthly-close/__tests__/route.test.ts` is REMOVED (preferred) or replaced with a named accurate-proxy mock (fallback). No "aspirational workaround" comment remains.
- All tests in both modified files pass.
- TypeScript compiles without errors.

**Commit:** `test(mock-hygiene): retire aspirational handleError mock from monthly-close route test; align iva-books/purchases/[id] mock with real middleware`

---

## Phase E — Regression gates

### T06 — Regression gate: ZodError branch unchanged

| Field | Value |
|---|---|
| **ID** | T06 |
| **Title** | REGRESSION-GATE: confirm ZodError branch tests pass unchanged |
| **Kind** | REGRESSION-GATE |
| **Files touched** | None (read-only verification) |
| **Preconditions** | T05 |

**Run:**
```
pnpm vitest run app/api/organizations/\[orgSlug\]/profile/
pnpm vitest run app/api/organizations/\[orgSlug\]/monthly-close/
pnpm vitest run app/api/organizations/\[orgSlug\]/iva-books/purchases/\[id\]/
```

**Tests to confirm:**
- `profile/__tests__/route.test.ts` → `"retorna 400 con fieldErrors cuando razonSocial está vacío"` — PASSES (ZodError→400 path).
- `profile/__tests__/route.test.ts` → `"retorna 400 cuando logoUrl no es una URL válida"` — PASSES.
- `monthly-close/__tests__/route.test.ts` → `"(f) returns 400 on invalid payload (missing periodId)"` — PASSES.
- `iva-books/purchases/[id]/__tests__/route.test.ts` → `"retorna 400 si el body tiene valores inválidos (Zod)"` — PASSES.

**Acceptance criteria:**
All four tests pass. If any fail, root cause must be identified and fixed before proceeding. A ZodError regression here is a BLOCKING issue.

**Commit:** None — verification only.

---

### T07 — Regression gate: unknown-error branch unchanged

| Field | Value |
|---|---|
| **ID** | T07 |
| **Title** | REGRESSION-GATE: confirm unknown-error branch tests pass unchanged |
| **Kind** | REGRESSION-GATE |
| **Files touched** | None (read-only verification) |
| **Preconditions** | T05 |

**Verification approach:**
The unknown-error branch (`Error interno del servidor` → 500) is covered implicitly by the per-file `handleError` mock defaults in all route tests. The real branch is exercised only at runtime (no dedicated test throws a plain `Error` at route level). After T04a extraction, the branch lives in `http-error-serializer.ts`. Confirm that:
1. No test file was modified to change unknown-error behavior.
2. A grep for `Error interno del servidor` in the serializer module still shows the unchanged branch.

```
# Verify the unknown branch is untouched (after extraction, look in http-error-serializer.ts):
grep -n "Error interno del servidor" features/shared/http-error-serializer.ts
```

Expected output: the line is present and unchanged.

**Acceptance criteria:**
- `grep` confirms the unknown-error branch line is present in `features/shared/http-error-serializer.ts` (moved there by T04a).
- `pnpm vitest run features/shared/` passes (the shared serializer behavior is tested indirectly via the feature tests).
- No test regressions in the full suite attributable to the unknown-error branch.

**Commit:** None — verification only.

---

## Phase F — Final gate and AC7 verification

### T08 — Final gate: full suite green, test count delta ≥ +1

| Field | Value |
|---|---|
| **ID** | T08 |
| **Title** | FINAL-GATE: full test suite green, test count ≥ +1 |
| **Kind** | FINAL-GATE |
| **Files touched** | None (read-only verification) |
| **Preconditions** | T06, T07 |

**Run:**
```
pnpm vitest run
```

**Acceptance criteria:**
- All tests pass (exit code 0).
- Test count is at least 1 higher than before this change (T03 adds at minimum 1 new test).
- No skipped tests that were previously passing.

**Commit:** None — gate only.

---

### T09 — Verify: no aspirational `handleError` mock remains (AC7)

| Field | Value |
|---|---|
| **ID** | T09 |
| **Title** | VERIFY: no aspirational handleError mock remains after fix |
| **Kind** | VERIFY |
| **Files touched** | None (grep-based audit) |
| **Preconditions** | T08 |

**Verification commands:**

```bash
# Check for any mock that spreads e.details in an AppError branch (aspirational pattern)
grep -rn "e\.details" app/api/ --include="*.test.ts"

# Check for any comment flagging handleError as aspirational or workaround
grep -rn "aspirational\|workaround" app/api/ --include="*.test.ts"

# Check for any remaining vi.mock of middleware or http-error-serializer in test files
# that still spreads e.details (would indicate an unreired aspirational mock)
grep -rn "vi\.mock.*middleware\|vi\.mock.*handleError\|vi\.mock.*http-error" app/api/ --include="*.test.ts"

# Confirm the real serializer is importable and not mocked in monthly-close tests
grep -rn "http-error-serializer\|handleError" app/api/organizations/\[orgSlug\]/monthly-close/__tests__/route.test.ts
```

**Expected outcomes:**
- `e.details` matches: either zero (all mocks removed) or only matches that are accurate proxy mocks (not labeled aspirational).
- `aspirational` / `workaround` matches: zero.
- `vi.mock.*middleware` matches in `monthly-close` test: zero (the mock was removed in T05).
- Any `vi.mock.*http-error-serializer` match must NOT spread `e.details` in an aspirational way — if it does, it is a new aspirational mock and must be flagged.

**Acceptance criteria:**
- No test file contains a `handleError` mock labeled "aspirational" or "workaround".
- The `vi.mock("@/features/shared/middleware", ...)` block that spread `e.details` no longer exists in `monthly-close/__tests__/route.test.ts`.
- If any `e.details` spread remains in a `handleError` mock, it is an accurate proxy (same pattern as real serializer, no workaround comment), not a masking mock.
- This step is the explicit application of Project Standard 4: the aspirational mock that detected W-01 is now retired because the real serializer honors the contract.
- AC9 side-effect confirmation: run `grep -n "new " features/shared/http-error-serializer.ts` at module scope level — expect zero matches outside function bodies.

**Commit:** None — verification only.

---

## Summary table

| ID | Title | Kind | Commit |
|---|---|---|---|
| T01 | Write delta spec | DOCS | `docs(spec): add delta spec for error-serialization capability` |
| T02 | Observe latent RED baseline (strip mock spread temporarily) | RED-OBS | None |
| T03 | RED: add LOCKED_EDIT route test | RED | `test(iva-books/purchases): RED — assert body.details.requiredMin for LOCKED_EDIT_REQUIRES_JUSTIFICATION route response` |
| T04a | REFACTOR: extract `handleError` to `http-error-serializer.ts` | REFACTOR | `refactor(middleware): extract handleError to http-error-serializer module` |
| T04b | CHORE: backward-compat re-export or caller update in `middleware.ts` | CHORE | Included with T04a or separate `chore(middleware): add handleError re-export for backward compatibility` |
| T04c | GREEN: patch AppError branch spread in `http-error-serializer.ts` | GREEN | `fix(http-error-serializer): spread AppError.details into HTTP response body when defined` |
| T05 | CHORE: retire aspirational mock; align iva-books/purchases mock | CHORE | `test(mock-hygiene): retire aspirational handleError mock from monthly-close route test; align iva-books/purchases/[id] mock with real middleware` |
| T06 | REGRESSION-GATE: ZodError unchanged | REGRESSION-GATE | None |
| T07 | REGRESSION-GATE: unknown-error unchanged | REGRESSION-GATE | None |
| T08 | FINAL-GATE: full suite green | FINAL-GATE | None |
| T09 | VERIFY: no aspirational mock remains | VERIFY | None |

**Task count: 11** (was 9; +2 for T04a and T04b from D7 extraction)
**Commit count: 5–6 (T01 if not pre-committed, T03, T04a, T04b if separate, T04c, T05)**
