/**
 * members.validation.ts — Zod schemas for the /members API payloads.
 *
 * PR6.1 / D.9:
 *   Introduces `buildAddMemberSchema(orgId)` and `buildUpdateMemberRoleSchema(orgId)`
 *   FACTORIES. The returned schemas replace the previous static enum with an
 *   ASYNC refine that checks the role slug against the org's current
 *   `CustomRole` table via `rolesService.exists(orgId, slug)`.
 *
 *   Factory pattern is mandatory because `orgId` is not known at module load
 *   time — every caller builds a fresh schema for its request.
 *
 *   Owner is blocked by a SYNC refine BEFORE the async one, so the DB is never
 *   hit for the "owner" slug (R.1-S2 preserved — owner is not assignable via
 *   this API even though the row exists).
 *
 *   Callers MUST use `parseAsync` / `safeParseAsync`. Calling `.parse` on a
 *   schema containing async refinements throws — this is Zod's contract and
 *   we rely on it as the regression-prevention mechanism for PR6.2 (see
 *   contract grep in members.service.test.ts).
 *
 * Legacy exports:
 *   `addMemberSchema` / `updateRoleSchema` (static enum-based) remain exported
 *   until PR8.2 final sweep. They are used only by tests/barrels today and are
 *   no longer the production validation path once PR6.2 routes migrate.
 */
import { z } from "zod";
import { rolesService } from "./roles.service.singleton";

// ───────────────────────────────────────────────────────────────
// Legacy static enum — kept only for backward compatibility with
// existing tests and barrel imports until PR8.2 removes dead exports.
// ───────────────────────────────────────────────────────────────
const assignableRoles = [
  "admin",
  "contador",
  "cobrador",
  "auxiliar",
  "member",
] as const;

const ROLE_ERROR =
  "Rol inválido. Debe ser: admin, contador, cobrador, auxiliar o member";

export const addMemberSchema = z.object({
  email: z.string().email("Email inválido"),
  role: z.enum(assignableRoles, { message: ROLE_ERROR }),
});

export const updateRoleSchema = z.object({
  role: z.enum(assignableRoles, { message: ROLE_ERROR }),
});

export type AddMemberDto = z.infer<typeof addMemberSchema>;
export type UpdateRoleDto = z.infer<typeof updateRoleSchema>;

// ───────────────────────────────────────────────────────────────
// PR6.1 — factory-based async schemas (production path)
// ───────────────────────────────────────────────────────────────

/**
 * Slugs that are stored in `CustomRole` with `isSystem=true` but MUST NOT be
 * assignable to a user via the /members API. Today only `owner` qualifies —
 * owner is seeded once on org creation and is managed through a separate
 * ownership-transfer flow, never through a plain "add member" POST.
 *
 * This sync guard runs BEFORE the async `rolesService.exists` check, so the
 * DB is never hit for non-assignable system slugs (cheap early rejection).
 */
const NON_ASSIGNABLE_SYSTEM_ROLES = new Set<string>(["owner"]);

function isAssignableSystemRoleOrCustom(slug: string): boolean {
  return !NON_ASSIGNABLE_SYSTEM_ROLES.has(slug);
}

function buildRoleSlugSchema(orgId: string) {
  return z
    .string()
    .min(1, "Rol requerido")
    // `abort: true` — if this sync guard fails, Zod MUST NOT run the async
    // refine below. Otherwise `rolesService.exists("<orgId>", "owner")` would
    // hit the DB unnecessarily (and worse: if exists=true for `owner`, the
    // second refine would have passed and we would have lost the cheap
    // early rejection for the non-assignable system slug).
    .refine(isAssignableSystemRoleOrCustom, {
      message: "Rol no asignable",
      abort: true,
    })
    .refine(
      async (slug) => rolesService.exists(orgId, slug),
      { message: "Rol inexistente en esta organización" },
    );
}

/**
 * Factory for the POST /members payload schema. Async refines require
 * `.parseAsync` / `.safeParseAsync` at every call site.
 */
export function buildAddMemberSchema(orgId: string) {
  return z.object({
    email: z.string().email("Email inválido"),
    role: buildRoleSlugSchema(orgId),
  });
}

/**
 * Factory for the PATCH /members/[memberId] payload schema.
 */
export function buildUpdateMemberRoleSchema(orgId: string) {
  return z.object({
    role: buildRoleSlugSchema(orgId),
  });
}

export type AddMemberPayload = {
  email: string;
  role: string;
};

export type UpdateMemberRolePayload = {
  role: string;
};
