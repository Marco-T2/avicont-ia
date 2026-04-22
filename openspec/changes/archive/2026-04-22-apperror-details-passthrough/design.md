# Design: apperror-details-passthrough

**Change:** `apperror-details-passthrough`
**Date:** 2026-04-22
**Phase:** Design

---

## 1. Architecture decision — conditional spread in `handleError` AppError branch

### Context after D7 extraction (updated)

`handleError` is extracted from `middleware.ts` into `features/shared/http-error-serializer.ts` (see §9 — Module extraction architecture). The architecture decision below applies to the extracted module; the `middleware.ts` file is updated to re-export `handleError` (or callers are updated) after extraction. The conditional spread is applied in the new module.

### Current code (the gap — in `middleware.ts` before extraction)

```typescript
// features/shared/middleware.ts — current state
if (error instanceof AppError) {
  return Response.json(
    { error: error.message, code: error.code },
    { status: error.statusCode },
  );
}
```

`error.details` is silently dropped.

### Target code (the fix — in `http-error-serializer.ts` after extraction)

```typescript
// features/shared/http-error-serializer.ts — after extraction + patch
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

This is a single-line addition (the conditional spread) inside the extracted module. The surrounding structure is unchanged.

### Why this pattern over alternatives

**Alternative A — `details: error.details ?? null`**
Rejected. A `null` key is semantically different from an absent key. Consumers doing `if (body.details)` would receive `null` and branch incorrectly. The absent-key convention (no `details` key = no structured data) is simpler and avoids null handling in all consumers.

**Alternative B — `details: error.details` (unconditional)**
Rejected. For `AppError` subclasses that carry no `details` (e.g., `NotFoundError`, `UnauthorizedError`), `error.details` is `undefined`. JSON serialization of `{ details: undefined }` omits the key in some serializers but is implementation-defined and should not be relied upon. The explicit conditional spread makes the intent clear and deterministic.

**Alternative C — Introduce a separate `serializeAppError` helper inside `handleError`**
Not warranted for an additional layer. The extraction itself provides the isolation. Within `http-error-serializer.ts`, the conditional spread is sufficient without an inner helper.

**Chosen pattern — conditional spread**
The truthy check (`error.details ?`) covers the case where `details` is `undefined` (the field exists on `AppError` as optional) or any falsy object (which does not occur in practice — `details` is either `undefined` or a non-empty `Record<string, unknown>`). This is the minimal, deterministic change.

---

## 2. Test harness decision for AC3 — representative route for `LOCKED_EDIT_REQUIRES_JUSTIFICATION`

### Candidate evaluation

The exploration identified these routes as exercising `validateLockedEdit` via service calls:
- `iva-books/purchases/[id]` (PATCH)
- `iva-books/sales/[id]` (PATCH)
- `dispatches-hub` (covers dispatches)
- payment routes
- journal routes

### Selection: `iva-books/purchases/[id]` PATCH

**Chosen route test file:**
`app/api/organizations/[orgSlug]/iva-books/purchases/[id]/__tests__/route.test.ts`

**Justification:**
1. **Leanest existing scaffold.** The file already has `describe("PATCH ...")` with three cases (200, 400 Zod, 404 not found). There is no `LOCKED_EDIT_REQUIRES_JUSTIFICATION` case. Adding one case requires zero new fixture setup — the existing `mockServiceInstance.updatePurchase` mock is already configured.
2. **The service (`IvaBooksService.updatePurchase`) calls `validateLockedEdit` internally.** The route handler already passes `justification` through to the service. Adding a `mockRejectedValue` that throws the typed error is one line.
3. **The `handleError` mock in this file does NOT spread `details`** (line 24-30 of the file: the AppError branch returns `{ error: e.message, code: e.code }` without `details`). This confirms the RED assertion will fail until the real middleware patch lands and the aspirational mock is removed or updated. This is the exact RED/GREEN flip pattern for AC3.
4. **Single domain, well-isolated.** The file already imports all needed types. No cross-file changes are required for the RED test.

Note: the `handleError` mock in this file uses duck-typing and explicitly omits `details` from the AppError branch. Once the real middleware patch lands (T05), the test must drop the `vi.mock` for `handleError` entirely (or update the mock to match real behavior). That mock hygiene action is a named task (T06) per Project Standard 2.

---

## 3. Test strategy for AC2 — aspirational mock retirement (updated for D6)

### Current state: tests are GREEN via aspirational mock

The aspirational `handleError` mock in `app/api/organizations/[orgSlug]/monthly-close/__tests__/route.test.ts` (lines 52-73) spreads `e.details`. The real `middleware.ts:39-43` does NOT. The tests at:

- **Lines 187-207** (test `(d) returns 422 PERIOD_HAS_DRAFT_ENTRIES with details`): PASS today via mock.
- **Lines 166-185** (test `(c) returns 422 PERIOD_UNBALANCED with details`): PASS today via mock.

The **real work for AC2 is mock retirement**, not an automatic flip. The proposal's original "flip RED→GREEN without test code changes" language was incorrect — there is no automatic flip because the tests are already GREEN. What changes is the mechanism behind GREEN: after T04c (patch in extracted module) + T05 (mock retirement), GREEN is backed by real middleware behavior, not aspirational mock.

### Revised verification strategy (three-step)

1. **T02 (RED-OBS — observation only):** temporarily modify the mock to remove the aspirational spread (strip `...(e.details ? { details: e.details } : {})`), run the two targeted tests, record the true RED baseline (`AssertionError: expected undefined to match object { ... }`), then restore the file. No commit. This is an empirical observation to document the latent RED that existed behind the aspiration.

2. **T04c (GREEN in new module):** after extraction, the patch is applied in `features/shared/http-error-serializer.ts`. The aspirational mock still exists at this point — tests remain GREEN via the mock and also would now pass via real middleware.

3. **T05 (mock retirement):** the aspirational mock in `monthly-close/__tests__/route.test.ts` is removed (preferred, enabled by extraction eliminating the OrganizationsService side effect) OR replaced with an accurate proxy-of-real. The `expect(body.details).toMatchObject({...})` assertion lines are NEVER touched — they pass via real middleware after retirement.

### Failure mode for AC2 verification

If T05 removes the mock AND T04c has NOT been applied (i.e., the serializer is extracted but not patched), the two tests fail with:
```
AssertionError: expected undefined to match object {
  dispatches: 2,
  payments: 1,
}
```
This is the correct latent RED, now surfaced. This failure mode is the verification signal that T04c is required before T05.

### Why extraction enables strict compliance

Without extraction, `vi.mock("@/features/shared/middleware", ...)` cannot be removed because `middleware.ts:9` instantiates `OrganizationsService` at module scope. Removing the mock pulls OrganizationsService → Prisma → test env breaks. The extraction moves `handleError` to a side-effect-free module, allowing the test to import the real serializer directly. This is the enabling change for strict AC7 compliance (see proposal §10).

---

## 4. Decimal serialization confirmation

`Prisma.Decimal` is backed by `decimal.js`. Its `toJSON()` method returns `this.toFixed()` — the full string representation with scale preserved (e.g., `new Prisma.Decimal("10000.00").toJSON()` returns `"10000.00"`). When `JSON.stringify` processes an object with a `Decimal` instance as a value, it calls `toJSON()` automatically, producing the string form.

**This means**: no custom serializer is needed. The `Decimal` instances in `PERIOD_UNBALANCED.details` will serialize as strings automatically when `details` is spread into the `Response.json(...)` call.

**Evidence from existing tests**: `app/api/organizations/[orgSlug]/monthly-close/__tests__/route.test.ts` lines 166-184 assert `body.details.debit === "10000.00"`, `body.details.credit === "9500.00"`, `body.details.diff === "500.00"` — string form. These tests are written against the aspirational mock which directly receives string-form values (the mock is constructed with `{ debit: "10000.00", ... }` already in string form at line 168-172). The real flow would carry `Prisma.Decimal` objects that auto-serialize to the same strings.

**AC4 is therefore a documentation task** (spec text in REQ-2), not an implementation task. No code change is required to make Decimal serialization work — it works today, it will continue to work after the one-line spread is added.

---

## 5. Project Standard 2 application plan — mock hygiene (updated for D7 extraction)

With extraction, the commit sequence for mock hygiene changes. Three commits are anticipated for the core work (plus T01/T03 for spec and RED test):

**Commit T04a — `refactor(middleware): extract handleError to http-error-serializer module`**
Moves `handleError` (all three branches: AppError, ZodError, unknown) from `middleware.ts` to `features/shared/http-error-serializer.ts`. Updates `middleware.ts` with a backward-compat re-export (or audits and updates callers). No behavior change — extraction only. All tests must pass at this point.

**Commit T04c — `fix(http-error-serializer): spread AppError.details into HTTP response body when defined`**
Applies the one-liner spread in the new module's AppError branch. This is the functional fix. `iva-books/purchases` tests flip from RED (T03's new test) to GREEN here. Monthly-close tests remain GREEN via their still-present aspirational mock.

**Commit T05 — `test(mock-hygiene): retire aspirational handleError mock from monthly-close route test`**
Removes the `vi.mock("@/features/shared/middleware", ...)` aspirational mock from `monthly-close/__tests__/route.test.ts` and replaces with a direct import of the real `handleError` from `http-error-serializer.ts` (or no mock at all). Also updates `iva-books/purchases/[id]/__tests__/route.test.ts` mock to spread `details` accurately. This commit MUST be named explicitly per Project Standard 2 — it MUST NOT be buried in T04c's diff.

**Why the extraction enables full mock removal (vs. prior uncertainty):**
The prior design noted "if `middleware.ts` imports `OrganizationsService`... a thin mock may be needed." That uncertainty is now RESOLVED by extraction. The new `http-error-serializer.ts` has zero module-scope side effects. A test can import `{ handleError } from "@/features/shared/http-error-serializer"` without triggering OrganizationsService or Prisma instantiation. The proxy-mock fallback is still available if unexpected import chains emerge at apply time, but the preferred path is strict removal.

---

## 6. Regression guard design — ZodError and unknown branches

The apply-phase agent MUST confirm the following tests pass unchanged after the middleware patch:

**ZodError branch (AC5):**
- `app/api/organizations/[orgSlug]/profile/__tests__/route.test.ts` — test `"retorna 400 con fieldErrors cuando razonSocial está vacío"` (line ~199) and `"retorna 400 cuando logoUrl no es una URL válida"` (line ~220). These exercise the ZodError→flatten→400 path via the profile route.
- `app/api/organizations/[orgSlug]/monthly-close/__tests__/route.test.ts` — test `"(f) returns 400 on invalid payload (missing periodId)"` (line ~221). This exercises ZodError via the monthly-close route.
- `app/api/organizations/[orgSlug]/iva-books/purchases/[id]/__tests__/route.test.ts` — test `"retorna 400 si el body tiene valores inválidos (Zod)"` (line ~183). This exercises ZodError via the purchases route.

These tests all use per-file `handleError` mocks that implement the ZodError branch correctly. After the middleware patch, these mocks remain correct because the patch does NOT touch the ZodError branch.

**Unknown-error branch (AC6):**
- No existing route test specifically exercises the plain-`Error` throw path (unknown branch). The unknown branch is covered by the mock default in tests that throw `new Error(...)` without `statusCode`. Confirm that none of the profile/purchases/monthly-close tests have regressed by running the full suite (T09).

---

## 7. No retirement needed

Project Standard 3 (retirement re-inventory gate) is **N/A** for this change. The exploration confirmed no dead `AppError` subclasses exist. No code is being deleted. No re-inventory is required.

---

## 8. Dependency overview (updated for D7 extraction)

```
T01 (DOCS: create spec file) — pre-satisfied by Phase 1 of sdd-ff
  ├─> T02 (RED-OBS: observe latent RED by temporarily stripping mock spread)
  └─> T03 (RED: add LOCKED_EDIT route test, RED assertion)
        └─> T04a (REFACTOR: extract handleError to http-error-serializer.ts)
              └─> T04b (CHORE: backward-compat re-export or caller update in middleware.ts)
                    └─> T04c (GREEN: patch AppError branch spread in http-error-serializer.ts)
                          └─> T05 (CHORE: mock hygiene — retire aspirational mock, named commit)
                                ├─> T06 (REGRESSION-GATE: ZodError tests pass unchanged)
                                ├─> T07 (REGRESSION-GATE: unknown-error branch untouched)
                                └─> T08 (FINAL-GATE: full suite green, test count +≥1)
                                      └─> T09 (VERIFY: no aspirational handleError mock remains)
```

---

## 9. Module extraction architecture

### Target module path

`features/shared/http-error-serializer.ts`

Rationale for name: "http-error-serializer" names the function (serialize HTTP error response) rather than the location (middleware). Follows the naming pattern in `features/shared/` where files are named by capability, not by infrastructure role.

Alternative `error-serializer.ts` is acceptable if the project favors shorter names. The constraint is that the name does NOT include "middleware" — the extraction's whole point is to separate the serialization concern from the middleware orchestration concern.

### Exported symbols

Primary export: `handleError` — the function that takes an unknown error and returns a `Response`.

Optional secondary export: a typed interface for the AppError response shape, if useful for test assertions:
```typescript
export interface AppErrorResponseBody {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}
```
Defer this to apply phase — add only if it reduces test boilerplate.

### What stays in `middleware.ts`

- `requireAuth` — Clerk auth check middleware
- `requireOrgAccess` — org membership check middleware
- `requireRole` — role-based access check middleware
- `const orgsService = new OrganizationsService()` — module-scope instantiation (stays here; this is the side effect that was blocking mock removal)

These are auth/session concerns and must NOT move to `http-error-serializer.ts`.

### What moves to `http-error-serializer.ts`

- `handleError` function — all three branches: AppError (with the new spread), ZodError, unknown
- Any types or imports that are exclusively used by `handleError` (e.g., `AppError`, `ZodError` imports)

Imports for `AppError`, `ValidationError`, etc. from `@/features/shared/errors` are expected. These have no side effects (they are class definitions). `ZodError` from `zod` likewise has no side effects.

### Backward-compatibility strategy for `middleware.ts`

After extraction, `middleware.ts` must be updated. Two options — decide at apply time based on caller audit:

**(a) Re-export** (prefer if callers > ~5 or spread across many files):
```typescript
// middleware.ts — after extraction
export { handleError } from "./http-error-serializer";
```
Zero caller change. Import paths from `@/features/shared/middleware` continue to work.

**(b) Update callers** (prefer if callers ≤ 5 and are concentrated in route files):
Update each caller to `import { handleError } from "@/features/shared/http-error-serializer"`.
`middleware.ts` does NOT re-export `handleError` — the separation is clean.

Audit at apply time: `grep -rn "handleError" app/ features/ --include="*.ts" --include="*.tsx"`.

### Side-effect confirmation (mandatory)

`features/shared/http-error-serializer.ts` MUST satisfy ALL of the following:
- Zero top-level `new` expressions
- Zero top-level calls to `auth()`, `currentUser()`, or any Clerk function
- Zero top-level Prisma client instantiation
- Zero top-level imports that themselves trigger any of the above at module load

Violation of any of these invalidates AC9 and AC7 strict compliance. Apply-phase agent must verify before committing T04a.
