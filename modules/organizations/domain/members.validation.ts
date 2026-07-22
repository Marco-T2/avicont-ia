/**
 * members.validation.ts -- Zod schemas for the /members API payloads.
 *
 * PR6.1 / D.9:
 *   `buildAddMemberSchema(orgId, rolesExists)` and
 *   `buildUpdateMemberRoleSchema(orgId, rolesExists)` are the ONLY
 *   production validation path. The returned schemas contain an ASYNC
 *   refine that checks the role slug against the org's current `CustomRole`
 *   table via the caller-supplied `rolesExists.exists(orgId, slug)`.
 *
 *   Factory pattern is mandatory because `orgId` is not known at module load
 *   time -- every caller builds a fresh schema for its request.
 *
 *   Owner is blocked by a SYNC refine BEFORE the async one, so the DB is never
 *   hit for the "owner" slug (R.1-S2 preserved -- owner is not assignable via
 *   this API even though the row exists).
 *
 *   Callers MUST use `parseAsync` / `safeParseAsync`. Calling `.parse` on a
 *   schema containing async refinements throws -- this is Zod's contract and
 *   we rely on it as the regression-prevention mechanism for PR6.2 (see
 *   contract grep in members.validation.contract.test.ts).
 *
 * PR8.2:
 *   Removed: `addMemberSchema`, `updateRoleSchema` (static enum-based legacy),
 *   `AddMemberDto`, `UpdateRoleDto`, and the `assignableRoles` private const.
 *   They were dead code -- no production path called them after PR6.2.
 *
 * Hex note (R1 paydown):
 *   This domain file used to import the `rolesService` singleton straight
 *   from `../presentation/roles.service.singleton` -- a domain → presentation
 *   reach. It now takes a narrow `RoleSlugExistencePort` parameter instead
 *   (defined right here, so this file stays dependency-free). Callers pass
 *   any object shaped `{ exists(orgId, slug): Promise<boolean> }` -- in
 *   production that's still the `rolesService` singleton, just wired in from
 *   the presentation layer instead of imported here.
 */
import { z } from "zod";

/**
 * Narrowest possible port for the one capability this schema factory needs:
 * "does this role slug exist in this org?". Declared locally so the domain
 * layer stays free of any presentation/infrastructure import.
 */
export interface RoleSlugExistencePort {
  exists(organizationId: string, slug: string): Promise<boolean>;
}

// ---------------------------------------------------------------
// PR6.1 -- factory-based async schemas (production path)
// ---------------------------------------------------------------

/**
 * Slugs that are stored in `CustomRole` with `isSystem=true` but MUST NOT be
 * assignable to a user via the /members API. Today only `owner` qualifies --
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

function buildRoleSlugSchema(orgId: string, rolesExists: RoleSlugExistencePort) {
  return z
    .string()
    .min(1, "Rol requerido")
    // `abort: true` -- if this sync guard fails, Zod MUST NOT run the async
    // refine below. Otherwise `rolesExists.exists("<orgId>", "owner")` would
    // hit the DB unnecessarily (and worse: if exists=true for `owner`, the
    // second refine would have passed and we would have lost the cheap
    // early rejection for the non-assignable system slug).
    .refine(isAssignableSystemRoleOrCustom, {
      message: "Rol no asignable",
      abort: true,
    })
    .refine(
      async (slug) => rolesExists.exists(orgId, slug),
      { message: "Rol inexistente en esta organizacion" },
    );
}

/**
 * Factory for the POST /members payload schema. Async refines require
 * `.parseAsync` / `.safeParseAsync` at every call site. `rolesExists` is
 * the narrow port used by the async refine (R1 paydown -- see file header).
 */
export function buildAddMemberSchema(
  orgId: string,
  rolesExists: RoleSlugExistencePort,
) {
  return z.object({
    email: z.string().email("Email invalido"),
    role: buildRoleSlugSchema(orgId, rolesExists),
  });
}

/**
 * Factory for the PATCH /members/[memberId] payload schema.
 */
export function buildUpdateMemberRoleSchema(
  orgId: string,
  rolesExists: RoleSlugExistencePort,
) {
  return z.object({
    role: buildRoleSlugSchema(orgId, rolesExists),
  });
}
