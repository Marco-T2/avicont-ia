# Spec: error-serialization

This spec defines the HTTP error serialization contract enforced by `features/shared/http-error-serializer.ts handleError`. The function handles three error branches — `AppError` (and all subclasses), `ZodError`, and unknown — and determines the JSON response body and HTTP status code for each. All `app/api/**/route.ts` handlers rely on this contract exclusively; no bespoke error serializers exist in the codebase.

---

## REQ-1 — HTTP error response shape for `AppError`

**This capability MUST:**

When a Next.js route handler's caught error is an `AppError` instance (or any subclass: `ValidationError`, `NotFoundError`, `ForbiddenError`, `ConflictError`, `UnauthorizedError`), the serialization middleware MUST include in the JSON response body:

- `error` (string): the value of `error.message`.
- `code` (string): the value of `error.code`.
- `details` (object, spread inline): the value of `error.details` — **only when `error.details` is defined and truthy**. When `error.details` is `undefined`, the `details` key MUST NOT appear in the response body.

The HTTP status code MUST be `error.statusCode`.

### Acceptance scenarios

**Scenario REQ-1a — AppError with defined `details`:**
> Given: a route handler throws a `ValidationError("msg", "SOME_CODE", { count: 3 })`.
> When: `handleError` serializes it.
> Then: the response body is `{ "error": "msg", "code": "SOME_CODE", "details": { "count": 3 } }`.
> The response status is 422.

**Scenario REQ-1b — AppError with `undefined` details:**
> Given: a route handler throws a `NotFoundError("resource")` (no `details` argument).
> When: `handleError` serializes it.
> Then: the response body is `{ "error": "resource no encontrado", "code": "NOT_FOUND" }`.
> The body MUST NOT contain a `"details"` key.
> The response status is 404.

**Implementation pattern (normative):**
```typescript
// Conditional spread — the ONLY accepted pattern
return Response.json(
  {
    error: error.message,
    code: error.code,
    ...(error.details ? { details: error.details } : {}),
  },
  { status: error.statusCode },
);
```

The alternative `details: error.details ?? null` is REJECTED: it leaks a `null` key into consumers when no details exist, breaking the "absent key means no details" contract.

---

## REQ-2 — Serialization contract for `Prisma.Decimal` fields in `details`

**This capability MUST:**

When a `details` payload contains `Prisma.Decimal` instances (current example: `PERIOD_UNBALANCED.details` carries `debit`, `credit`, and `diff` as `Prisma.Decimal`), those fields MUST serialize as **strings** in the HTTP JSON body via `Prisma.Decimal.toJSON()`.

- Consumers MUST treat these fields as strings and parse them explicitly (e.g., `new Decimal(body.details.debit)`) if arithmetic is required.
- Consumers MUST NOT use `parseFloat` on these fields — `parseFloat` discards trailing zeros and may lose precision for monetary amounts (e.g., `parseFloat("10000.00")` returns `10000`, not `"10000.00"`).

### Rationale

`Prisma.Decimal` (backed by `decimal.js`) implements a `toJSON()` method that returns the decimal's string representation (e.g., `"10000.00"`). When `JSON.stringify` serializes an object containing a `Decimal` instance, it calls `toJSON()`, producing the string form. This is automatic — no custom serializer is required. The string form preserves scale (number of decimal places), which is required for monetary display and round-trip parsing.

### Acceptance scenarios

**Scenario REQ-2a — `PERIOD_UNBALANCED` details serialize as strings:**
> Given: `monthly-close.service.ts` throws `new ValidationError("msg", PERIOD_UNBALANCED, { debit: new Prisma.Decimal("10000.00"), credit: new Prisma.Decimal("9500.00"), diff: new Prisma.Decimal("500.00") })`.
> When: `handleError` serializes it.
> Then: the response body contains `"details": { "debit": "10000.00", "credit": "9500.00", "diff": "500.00" }`.
> All three values MUST be JSON strings, not JSON numbers.

**Scenario REQ-2b — Consumer precision contract:**
> Given: a consumer receives `body.details.debit = "10000.00"`.
> When: the consumer needs to compute with that value.
> Then: the consumer MUST call `new Prisma.Decimal(body.details.debit)` (or equivalent), not `parseFloat(body.details.debit)`.

---

## REQ-3 — ZodError branch behavior unchanged (regression guard)

**This capability MUST:**

The middleware's `ZodError` branch MUST continue to return `{ error: "Datos inválidos", details: zodError.flatten() }` with HTTP status 400, without any regression. This branch is the existing production path for `company-profile-form.tsx` validation responses and MUST NOT be modified.

### Acceptance scenario

**Scenario REQ-3a — ZodError path produces validation details:**
> Given: a route handler's Zod schema parse throws a `ZodError` with field errors.
> When: `handleError` serializes it.
> Then: the response body is `{ "error": "Datos inválidos", "details": { "fieldErrors": {...}, "formErrors": [...] } }`.
> The response status is 400.
> This behavior is unchanged before and after the middleware patch.

---

## REQ-4 — Unknown-error branch behavior unchanged (regression guard)

**This capability MUST:**

Non-`AppError`, non-`ZodError` errors (plain `Error`, `TypeError`, `Prisma.PrismaClientKnownRequestError`, etc.) MUST continue to return `{ "error": "Error interno del servidor" }` with HTTP status 500 and NO `details` key. The `handleError` fix to the `AppError` branch MUST NOT touch this branch.

### Acceptance scenario

**Scenario REQ-4a — Unknown error produces no details:**
> Given: a route handler throws `new Error("unexpected")`.
> When: `handleError` serializes it.
> Then: the response body is `{ "error": "Error interno del servidor" }`.
> The body MUST NOT contain a `"details"` key.
> The response status is 500.

---

## REQ-5 — Structural primacy of `details` over message (consumer contract)

**This capability MUST:**

When a structured `details` field exists for a given error code, that field is the CANONICAL API contract for machine-readable data. The human-readable `message` MAY embed the same information for UX purposes, but consumers MUST NOT parse the `message` string to extract values that are already present in `details`.

Current error codes with canonical `details` fields:

| Error code | `details` shape | Notes |
|---|---|---|
| `PERIOD_HAS_DRAFT_ENTRIES` | `{ dispatches: number, payments: number, journalEntries: number, sales: number, purchases: number }` | Per-entity draft counts. See `openspec/specs/monthly-period-close/spec.md` REQ-4. |
| `PERIOD_UNBALANCED` | `{ debit: string, credit: string, diff: string }` | Monetary amounts serialized as strings (REQ-2). |
| `LOCKED_EDIT_REQUIRES_JUSTIFICATION` | `{ requiredMin: number }` | Minimum justification character count (10 or 50 depending on period status). |

### Acceptance scenario

**Scenario REQ-5a — Consumer reads `requiredMin` from `details`, not from message:**
> Given: a locked-edit update route responds with `{ "code": "LOCKED_EDIT_REQUIRES_JUSTIFICATION", "error": "Se requiere una justificación de al menos 50 caracteres...", "details": { "requiredMin": 50 } }`.
> When: a consumer (UI, API client, test) needs to know the minimum character count.
> Then: the consumer MUST read `body.details.requiredMin` (a number), NOT parse `body.error` with regex or string splitting.

---

## REQ-6 — Testability: error serialization function MUST be importable without module-scope side effects

**This capability MUST:**

The error serialization function (`handleError`) MUST be importable in a test context without triggering module-scope side effects. Specifically, importing `handleError` MUST NOT:

- Instantiate `OrganizationsService` or any other service class at module load time.
- Call `auth()`, `currentUser()`, or any Clerk function at module load time.
- Connect to or instantiate a Prisma client at module load time.

This requirement exists so that integration-level tests can import the real `handleError` (from its standalone module) and exercise the real serialization logic without requiring `vi.mock`. This is the mechanism that enables strict compliance with Project Standard 4 (aspirational mocks signal unimplemented contract) — a test that uses the real serializer is not aspirational; it exercises the actual contract.

### Acceptance scenarios

**Scenario REQ-6a — Real serializer importable in test without vi.mock:**
> Given: a test file imports `{ handleError } from "@/features/shared/http-error-serializer"` (or equivalent standalone module).
> When: the test module is loaded.
> Then: no `OrganizationsService` constructor runs, no Prisma client is created, no Clerk function is invoked.
> The import succeeds and `handleError` is callable in the test.

**Scenario REQ-6b — Tests in `monthly-close/__tests__/route.test.ts` use real serializer after mock retirement:**
> Given: T05 (mock hygiene) has retired the `vi.mock("@/features/shared/middleware", ...)` aspirational mock.
> When: the monthly-close route tests run.
> Then: `handleError` is exercised via the real implementation (imported from the standalone module), not a mock.
> The assertions at lines 65-67 and 166-184 pass via real middleware behavior.
