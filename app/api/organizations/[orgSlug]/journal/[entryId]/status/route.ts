import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { UsersService } from "@/features/shared/users.service";
import { JournalService } from "@/features/accounting/server";
import { statusTransitionSchema } from "@/features/accounting/accounting.validation";

const usersService = new UsersService();
const service = new JournalService();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; entryId: string }> },
) {
  try {
    const { orgSlug, entryId } = await params;
    const { session, orgId } = await requirePermission(
      "journal",
      "write",
      orgSlug,
    );
    const clerkUserId = session.userId;

    const body = await request.json();
    const { status, justification } = statusTransitionSchema.parse(body);

    const user = await usersService.resolveByClerkId(clerkUserId);

    const updated = await service.transitionStatus(orgId, entryId, status, user.id, justification);

    return Response.json(updated);
  } catch (error) {
    return handleError(error);
  }
}
