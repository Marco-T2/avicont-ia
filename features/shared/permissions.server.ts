import { requireAuth, requireOrgAccess, requireRole } from "./middleware";
import { PERMISSIONS_READ, PERMISSIONS_WRITE } from "./permissions";
import type { Action, Resource } from "./permissions";

/**
 * Single server-side authorization gate used by all org route handlers.
 *
 * Resolves session + orgId, then checks that the caller's role is in the
 * matrix for (resource, action). Fails fast with ForbiddenError (403) when
 * it is not. W-draft (auxiliar posting sales/purchases) is NOT enforced
 * here — that lives at the service layer in canPost. See design D.2 / D.3.
 */
export async function requirePermission(
  resource: Resource,
  action: Action,
  orgSlug: string,
) {
  const session = await requireAuth();
  const orgId = await requireOrgAccess(session.userId, orgSlug);
  const allowedRoles =
    action === "read" ? PERMISSIONS_READ[resource] : PERMISSIONS_WRITE[resource];
  const member = await requireRole(session.userId, orgId, [...allowedRoles]);
  return { session, orgId, role: member.role };
}
