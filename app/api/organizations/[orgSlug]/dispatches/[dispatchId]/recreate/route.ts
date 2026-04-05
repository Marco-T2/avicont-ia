import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { UsersService } from "@/features/shared/users.service";
import { DispatchService } from "@/features/dispatch";

const usersService = new UsersService();
const dispatchService = new DispatchService();

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; dispatchId: string }> },
) {
  try {
    const { userId: clerkUserId } = await requireAuth();
    const { orgSlug, dispatchId } = await params;
    const orgId = await requireOrgAccess(clerkUserId, orgSlug);
    await requireRole(clerkUserId, orgId, ["owner", "admin"]);

    const user = await usersService.resolveByClerkId(clerkUserId);

    const result = await dispatchService.recreate(orgId, dispatchId, user.id);

    return Response.json(result, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
