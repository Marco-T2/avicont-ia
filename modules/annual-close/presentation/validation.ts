import { z } from "zod";

/**
 * Zod request schema for `POST /api/organizations/[orgSlug]/annual-close`
 * (design rev 2 §6 + REQ-7.4).
 *
 * Validates the request body:
 *   - `year`: integer ∈ [1900, 2100] (coerced from string for query/form
 *     callers; route handler always submits JSON number).
 *
 * **Justification removal**: the field was dropped from the UI (modal had a
 * required 50-char textarea that added pure friction without audit value —
 * users typed boilerplate). The route handler now auto-generates a
 * deterministic string server-side and passes it to `service.close(...)`.
 * The service-layer `MIN_JUSTIFICATION_LENGTH` invariant (≥50 chars) is
 * preserved because the auto-generated text is always ≥50 chars. The
 * `audit_logs.justification` column still gets populated (via AuditContext +
 * session var + trigger), just with auto text instead of user input.
 *
 * **Voseo Rioplatense** (REQ-7.4): error messages targeting the end-user
 * use voseo phrasing.
 *
 * **S-2 sentinel** (DEC-1 boundary): this file MUST NOT import `Prisma`
 * from `@/generated/prisma/client`.
 */
export const annualCloseRequestSchema = z.object({
  year: z.coerce
    .number()
    .int("El año debe ser un número entero")
    .min(1900, "El año debe estar entre 1900 y 2100")
    .max(2100, "El año debe estar entre 1900 y 2100"),
});

export type AnnualCloseRequest = z.infer<typeof annualCloseRequestSchema>;
