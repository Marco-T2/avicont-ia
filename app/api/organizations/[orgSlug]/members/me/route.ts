import { requireAuth, requireOrgAccess, handleError } from "@/features/shared";
import { OrganizationsService } from "@/features/organizations/server";

const orgService = new OrganizationsService();

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { userId: clerkUserId } = await requireAuth();
    const { orgSlug } = await ctx.params;
    const orgId = await requireOrgAccess(clerkUserId, orgSlug);

    const member = await orgService.getMemberByClerkUserId(orgId, clerkUserId);

    return Response.json({ role: member.role });
  } catch (error) {
    return handleError(error);
  }
}
