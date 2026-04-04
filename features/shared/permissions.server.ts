import { requireAuth, requireOrgAccess, requireRole } from "./middleware";
import { PERMISSIONS } from "./permissions";
import type { Resource } from "./permissions";

export async function requirePermission(resource: Resource, orgSlug: string) {
  const session = await requireAuth();
  const orgId = await requireOrgAccess(session.userId, orgSlug);
  const allowedRoles = PERMISSIONS[resource];
  const member = await requireRole(session.userId, orgId, allowedRoles);
  return { session, orgId, member };
}
