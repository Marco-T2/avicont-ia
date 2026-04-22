import { auth } from "@clerk/nextjs/server";
import { UnauthorizedError } from "./errors";
import { OrganizationsService } from "@/features/organizations/organizations.service";

export { handleError } from "./http-error-serializer";

const orgsService = new OrganizationsService();

export async function requireAuth() {
  const session = await auth();
  if (!session.userId) throw new UnauthorizedError();
  return session;
}

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
