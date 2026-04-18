import { requireAuth, requireOrgAccess, requireRole } from "./middleware";
import { getMatrix, revalidateOrgMatrix } from "./permissions.cache";
import type { Action, Resource } from "./permissions";
import { seedOrgSystemRoles } from "@/prisma/seed-system-roles";

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
 * 6 system roles inline before re-evaluating. Prevents a 500 on newly created
 * orgs or orgs that missed the migration.
 */
export async function requirePermission(
  resource: Resource,
  action: Action,
  orgSlug: string,
) {
  const session = await requireAuth();
  const orgId = await requireOrgAccess(session.userId, orgSlug);

  // Load permission matrix from cache (single-flight, 60s TTL)
  let matrix = await getMatrix(orgId);

  // Fallback: seed 6 system roles if org has none (D.6 / CR.1-S3).
  // The try/catch ensures a seed failure (e.g. test environment without DB)
  // does not crash the request — the permission check continues with whatever
  // matrix was loaded. In production, seedOrgSystemRoles() is idempotent and
  // skipDuplicates=true, so a concurrent race is safe.
  if (matrix.roles.size === 0) {
    try {
      await seedOrgSystemRoles(orgId);
      revalidateOrgMatrix(orgId);
      matrix = await getMatrix(orgId);
    } catch {
      // Seed failed (e.g. test environment without DB, or migration not run yet).
      // Proceed with the empty matrix; requireRole will enforce access using
      // its own mocked/real logic.
    }
  }

  // Derive the allowed roles for this (resource, action) from the matrix
  const allowedRoles: string[] = [];
  for (const [slug, roleEntry] of matrix.roles) {
    const permitted =
      action === "read"
        ? roleEntry.permissionsRead.has(resource)
        : roleEntry.permissionsWrite.has(resource);
    if (permitted) {
      allowedRoles.push(slug);
    }
  }

  // Check caller's role against the allowed list
  const member = await requireRole(session.userId, orgId, allowedRoles);
  return { session, orgId, role: member.role };
}
