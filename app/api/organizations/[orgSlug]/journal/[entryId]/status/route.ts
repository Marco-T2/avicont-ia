import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { UsersService } from "@/features/shared/users.service";
import { JournalService } from "@/features/accounting";
import { statusTransitionSchema } from "@/features/accounting/accounting.validation";

const usersService = new UsersService();
const service = new JournalService();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; entryId: string }> },
) {
  try {
    const { userId: clerkUserId } = await requireAuth();
    const { orgSlug, entryId } = await params;
    const orgId = await requireOrgAccess(clerkUserId, orgSlug);
    await requireRole(clerkUserId, orgId, ["owner", "admin", "contador"]);

    const body = await request.json();
    const { status } = statusTransitionSchema.parse(body);

    const user = await usersService.resolveByClerkId(clerkUserId);

    const updated = await service.transitionStatus(orgId, entryId, status, user.id);

    return Response.json(updated);
  } catch (error) {
    return handleError(error);
  }
}
