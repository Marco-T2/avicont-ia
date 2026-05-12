import "server-only";
import { requireAuth } from "@/features/shared/middleware";
import { requireOrgAccess, requireRole } from "@/modules/organizations/presentation/server";
import { ensureOrgSeeded, getMatrix } from "./permissions.cache";
import type { Action, Resource, PostableResource } from "./permissions";
import type { OrgMatrix } from "./permissions.cache";

/** Internal helper: picks the correct permission Set based on the action. */
function _permitted(
  action: Action,
  roleEntry: OrgMatrix["roles"] extends Map<string, infer V> ? V : never,
  resource: Resource,
): boolean {
  switch (action) {
    case "read":   return roleEntry.permissionsRead.has(resource);
    case "write":  return roleEntry.permissionsWrite.has(resource);
    case "close":  return roleEntry.canClose.has(resource);
    case "reopen": return roleEntry.canReopen.has(resource);
  }
}

/**
 * Single server-side authorization gate used by all org route handlers.
 *
 * Resolves session + orgId, loads the org's permission matrix from cache,
 * derives the allowed role list for (resource, action), then checks that the
 * caller's role is in that list. Fails fast with ForbiddenError (403) when not.
 *
 * Signature: (resource, action, orgSlug) — FROZEN across all 62+ call sites.
 * Internal implementation is now DB-backed via permissions.cache (D.3 / P.3mod).
 *
 * Seed fallback (D.6 / CR.1-S3): if the org has 0 custom_roles rows, seeds the
 * 5 system roles inline before re-evaluating. Prevents a 500 on newly created
 * orgs or orgs that missed the migration.
 */
export async function requirePermission(
  resource: Resource,
  action: Action,
  orgSlug: string,
) {
  const session = await requireAuth();
  const orgId = await requireOrgAccess(session.userId, orgSlug);

  // Load permission matrix from cache, seeding 5 system roles if the org has none.
  // ensureOrgSeeded handles the D.6 / CR.1-S3 fallback: if roles.size === 0, seeds
  // the org, revalidates the cache, and reloads. Seed failures propagate (Audit H #2)
  // — an infra failure must surface as a 5xx, not a phantom 403 from an empty matrix.
  const matrix = await ensureOrgSeeded(orgId);

  // Derive the allowed roles for this (resource, action) from the matrix
  const allowedRoles: string[] = [];
  for (const [slug, roleEntry] of matrix.roles) {
    const permitted = _permitted(action, roleEntry, resource);
    if (permitted) {
      allowedRoles.push(slug);
    }
  }

  // Check caller's role against the allowed list
  const member = await requireRole(session.userId, orgId, allowedRoles);
  return { session, orgId, role: member.role };
}

/**
 * Async — reads from the org's cached permission matrix.
 * Use this in server-side code. The cache handles TTL, single-flight, and
 * the fallback seed is handled by requirePermission / getMatrix. (D.7 / P.2mod)
 *
 * Moved from permissions.ts to permissions.server.ts to prevent the module from
 * being bundled into client chunks (permissions.cache → prisma → pg → dns).
 * Client-side permission checks go through useCanAccess() / <Gated> (PR7.1).
 */
export async function canAccess(
  role: string,
  resource: Resource,
  action: Action,
  orgId: string,
): Promise<boolean> {
  const matrix = await getMatrix(orgId);
  const roleEntry = matrix.roles.get(role);
  if (!roleEntry) return false;
  return _permitted(action, roleEntry, resource);
}

/**
 * Async — reads from the org's cached permission matrix.
 * Use this in server-side service code (sale.service, purchase.service, journal.service).
 * (D.7 / P.6)
 *
 * Moved from permissions.ts to permissions.server.ts to prevent the module from
 * being bundled into client chunks (permissions.cache → prisma → pg → dns).
 */
export async function canPost(
  role: string,
  resource: PostableResource,
  orgId: string,
): Promise<boolean> {
  const matrix = await getMatrix(orgId);
  const roleEntry = matrix.roles.get(role);
  if (!roleEntry) return false;
  return roleEntry.canPost.has(resource);
}
