import "server-only";
import { OrganizationsService } from "./organizations.service";

const orgsService = new OrganizationsService();

export async function requireOrgAccess(
  clerkUserId: string,
  orgSlug: string,
): Promise<string> {
  return orgsService.verifyMembership(clerkUserId, orgSlug);
}

export async function requireRole(
  clerkUserId: string,
  orgId: string,
  roles: string[],
) {
  return orgsService.requireMemberWithRoles(orgId, clerkUserId, roles);
}
