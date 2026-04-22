# Exploration: apperror-details-passthrough

**Change name:** `apperror-details-passthrough`
**Date:** 2026-04-22
**Phase:** Exploration / Audit only

---

## 1. Context

During `sdd-verify` of the archived change `fiscal-period-monthly-create`, finding W-01 identified that `features/shared/middleware.ts handleError` serializes `AppError` as `{ error: error.message, code: error.code }` and does NOT spread `.details` into the HTTP response body. Route tests for the monthly-close endpoint mock `handleError` with an aspirational implementation that DOES include `details`, masking the gap entirely. Canonical spec `openspec/specs/monthly-period-close/spec.md` REQ-4 mandates that `PERIOD_HAS_DRAFT_ENTRIES` responses carry per-entity counts — the service emits them correctly (verified in `monthly-close.service.ts`), but the middleware silently drops them on the floor before the response reaches any client.

---

## 2. Audit Table

| error_code | details_shape | emitters | real_consumers | mock_consumers | inexistent_consumers | risk_classification |
|---|---|---|---|---|---|---|
| `PERIOD_HAS_DRAFT_ENTRIES` | `{ dispatches: number, payments: number, journalEntries: number, sales: number, purchases: number }` | `features/monthly-close/monthly-close.service.ts:166` | none (UI reads `data.error` only; counts come from `/summary`) | `app/api/organizations/[orgSlug]/monthly-close/__tests__/route.test.ts:65-67` — aspirational: spreads `e.details` | `true` (UI ignores details completely) | SAFE-FIX |
| `PERIOD_UNBALANCED` | `{ debit: Decimal, credit: Decimal, diff: Decimal }` | `features/monthly-close/monthly-close.service.ts:194` | none | `app/api/organizations/[orgSlug]/monthly-close/__tests__/route.test.ts:65-67` — aspirational (same mock spreads `e.details`) | `true` | SAFE-FIX |
| `LOCKED_EDIT_REQUIRES_JUSTIFICATION` | `{ requiredMin: number }` | `features/shared/document-lifecycle.service.ts:120-124` | none (no UI component reads `requiredMin` from HTTP response; message already embeds the character count) | service-level tests in `features/shared/__tests__/document-lifecycle.test.ts:53,79` and `features/payment/__tests__/payment.service.locked-edit.test.ts:98,116` — these test the thrown error object directly, NOT the HTTP response; they are NOT aspirational handleError mocks | `true` | SAFE-FIX |

---

## 3. Per-Error Detail Narrative

### PERIOD_HAS_DRAFT_ENTRIES

The service at `monthly-close.service.ts:166` throws `new ValidationError(msg, PERIOD_HAS_DRAFT_ENTRIES, { dispatches, payments, journalEntries, sales, purchases })`. The five-key shape matches `validateCanClose()` which is also used by the `/summary` endpoint — this is the shared-contract design (REQ-5). The production UI component `components/settings/monthly-close-panel.tsx` at line 142 reads only `data.error` from the close POST response; it does NOT read `data.details` because it obtains draft counts from the separate GET `/summary` call. There are zero real consumers of `PERIOD_HAS_DRAFT_ENTRIES` details from the HTTP response. The one mock consumer (`monthly-close/__tests__/route.test.ts`) is fully aspirational: it spreads `e.details` in its `handleError` mock at line 65-67, which is exactly the contract the real middleware should honor.

### PERIOD_UNBALANCED

The service at `monthly-close.service.ts:194` throws `new ValidationError(msg, PERIOD_UNBALANCED, { debit, credit, diff })` using `Prisma.Decimal` values. No production UI component reads `debit`/`credit`/`diff` from an HTTP error response. The same aspirational mock in `monthly-close/__tests__/route.test.ts` covers this error at line 166-184, asserting `body.details` contains the three keys. Note: since `details` carries `Prisma.Decimal` instances, the serialization behavior (whether `Decimal` serializes as a number or string via `JSON.stringify`) should be verified in the propose phase to ensure the HTTP body is consistent.

### LOCKED_EDIT_REQUIRES_JUSTIFICATION

The validation helper at `document-lifecycle.service.ts:120-124` throws `new ValidationError(msg, LOCKED_EDIT_REQUIRES_JUSTIFICATION, { requiredMin })` where `requiredMin` is either 10 or 50. No UI component reads `requiredMin` from an HTTP error response — the human-readable message already embeds the character count. The service-level tests that assert `details.requiredMin` (`document-lifecycle.test.ts:53,79`, `payment.service.locked-edit.test.ts:98,116`) test the THROWN error object directly (not an HTTP response), so they are correctly passing today and are NOT aspirational middleware mocks. They will not need to change after the middleware fix, but route-level tests for documents, purchases, sales, dispatch, and payment endpoints that exercise the locked-edit path should be tightened to also assert `body.details.requiredMin` once `handleError` passes it through.

---

## 4. Additional Scope Checks

### AppError subclasses without details

All other `AppError` subclasses (`NotFoundError`, `ForbiddenError`, `UnauthorizedError`, `ConflictError`) have no `details` parameter in their constructor or throw sites in the current codebase. They are unaffected by the fix because `error.details` will be `undefined` for all of them, and the proposed spread `...(error.details ? { details: error.details } : {})` will emit nothing for those cases.

### Non-AppError throw sites

`handleError` handles three cases:
1. `ZodError` → `{ error, details: error.flatten() }` — already correct; `details` IS included.
2. `AppError` → `{ error, code }` — gap: `details` dropped.
3. `unknown` → `{ error: "Error interno del servidor" }` — no `details` to pass; non-AppError errors (plain `Error`, `TypeError`, Prisma `PrismaClientKnownRequestError`) fall here. The fix to the `AppError` branch does not touch the `ZodError` or unknown branches, so there is no regression risk.

### Is `handleError` the only HTTP error serialization path?

All `app/api/**/route.ts` files use `return handleError(error)` in their `catch` blocks. The `Response.json(` and `NextResponse.json(` calls in error branches are exclusively in test mock implementations. No route was found with a bespoke error serializer that bypasses `handleError`. The company-profile-form.tsx reads `data.details` from a 400 response, but that comes from the ZodError branch of `handleError` (which already works correctly) — not from an AppError.

---

## 5. Summary Risk Distribution

| Classification | Count | Codes |
|---|---|---|
| SAFE-FIX | 3 | `PERIOD_HAS_DRAFT_ENTRIES`, `PERIOD_UNBALANCED`, `LOCKED_EDIT_REQUIRES_JUSTIFICATION` |
| INVESTIGATE | 0 | — |
| BREAKING | 0 | — |

**Total error codes with `details`: 3**

---

## 6. Scope Recommendation for Propose Phase

**SAFE-FIX-ONE-LINER** — all three error codes have zero real consumers of `details` in production HTTP responses. Adding `details` to the middleware response is a one-liner with no observable production impact. The only work beyond the middleware patch is assertion tightening in:

1. `monthly-close/__tests__/route.test.ts` — already has the aspirational assertions for both `PERIOD_HAS_DRAFT_ENTRIES` and `PERIOD_UNBALANCED`; these will now pass without any mock change (the mock will simply stop being the bottleneck once the real middleware matches it).
2. Route-level tests for all route handlers that exercise `validateLockedEdit` (purchases, sales, dispatch, payment, journal) — none currently assert `body.details.requiredMin`. These should be tightened, but they are low-priority because there is no real consumer.

One caveat for the propose phase: `PERIOD_UNBALANCED` details carry `Prisma.Decimal` objects. The proposer should confirm whether `JSON.stringify` serializes them as numbers or strings (Prisma `Decimal` has a `toJSON` that returns the string representation), and whether the downstream contract should enforce one or the other.

---

## 7. Open Questions for the Orchestrator

1. **`Prisma.Decimal` serialization in `PERIOD_UNBALANCED` details** — `Decimal.toJSON()` returns a plain string (e.g., `"10000.00"`), so `JSON.stringify` will produce string values. The existing route test at line 168-184 uses string literals (`"10000.00"`, `"9500.00"`, `"500.00"`) which matches this behavior. But the proposer should explicitly document the serialized type to set the contract.

2. **Test tightening scope** — The aspirational mock in `monthly-close/__tests__/route.test.ts` means those two assertions (`body.details` for `PERIOD_HAS_DRAFT_ENTRIES` and `PERIOD_UNBALANCED`) will START passing once the middleware is fixed. The proposer should decide whether to treat those as "free RED→GREEN" in the task list, or explicitly task them. They are currently RED (because the real middleware drops `details`).

3. **`LOCKED_EDIT_REQUIRES_JUSTIFICATION` route test coverage** — No existing route test asserts `body.details.requiredMin`. This was never needed because no UI reads it. Should the propose phase mandate a RED test for this path? It is optional from a consumer perspective but closes the contract gap.

4. **Scope of `openspec/specs/monthly-period-close/spec.md` update** — REQ-4 currently specifies `error.details` fields. The archived change notes this is the canonical REQ. After the middleware fix lands, REQ-4 will be honored in production. No spec text needs to change; it's the implementation that needs to catch up.

5. **`monthly-close-ui-reconciliation` unblocking** — The archive note for `fiscal-period-monthly-create` flags this change as a prerequisite for the `monthly-close-ui-reconciliation` UI change, which expects to read `error.details` from the close endpoint. The proposer should confirm that after the middleware fix, `monthly-close-panel.tsx` should be updated to use `error.details` (per-entity draft counts) rather than triggering a separate `/summary` refetch, OR that the UI reconciliation change will handle that — to avoid double-fixing the UI.
