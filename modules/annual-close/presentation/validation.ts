import { z } from "zod";

/**
 * Zod request schema for `POST /api/organizations/[orgSlug]/annual-close`
 * (Phase 5.3 GREEN, design rev 2 §6 + spec REQ-2.1 + REQ-7.4).
 *
 * Validates the request body:
 *   - `year`: integer ∈ [1900, 2100] (coerced from string for query/form
 *     callers; route handler always submits JSON number).
 *   - `justification`: string ≥ 50 chars (spec REQ-2.1 — required for
 *     LOCKED-document mutations; AuditContext propagates it to audit_logs).
 *
 * **Voseo Rioplatense** (REQ-7.4): error messages targeting the end-user
 * use voseo phrasing. Anchor strings ("debe tener al menos 50",
 * "debe ser un número entero", "debe estar entre") are addressed in the
 * second person plural rioplatense register.
 *
 * **Zod 4 API**: per-issue messages are passed positionally to the
 * constraint methods (`.int(msg)`, `.min(n, msg)`, `.max(n, msg)`). The
 * v3 `invalid_type_error` / `required_error` options have been removed in
 * Zod 4 (verified via tsc on the canonical `@/generated/...` ZodString
 * overloads — mirror `modules/shared/presentation/pagination.schema.ts:10`
 * + `modules/audit/presentation/validation.ts:29` precedent for
 * `z.coerce.number()` chaining without options bag).
 *
 * **S-2 sentinel** (DEC-1 boundary): this file MUST NOT import `Prisma`
 * from `@/generated/prisma/client` — validation lives in presentation,
 * not infrastructure. The annual-close DEC-1 sentinel
 * (`modules/annual-close/__tests__/decimal-import.sentinel.test.ts`) scans
 * domain + application only; presentation is implicitly out of scope but
 * still observes the principle (no money math here, no Prisma types here).
 */
export const annualCloseRequestSchema = z.object({
  year: z.coerce
    .number()
    .int("El año debe ser un número entero")
    .min(1900, "El año debe estar entre 1900 y 2100")
    .max(2100, "El año debe estar entre 1900 y 2100"),
  justification: z
    .string()
    .min(50, "La justificación debe tener al menos 50 caracteres"),
});

export type AnnualCloseRequest = z.infer<typeof annualCloseRequestSchema>;
