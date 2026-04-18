import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { UsersService } from "@/features/shared/users.service";
import { DispatchService } from "@/features/dispatch";

const usersService = new UsersService();
const dispatchService = new DispatchService();

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; dispatchId: string }> },
) {
  try {
    const { orgSlug, dispatchId } = await params;
    const { session, orgId } = await requirePermission(
      "dispatches",
      "write",
      orgSlug,
    );
    const clerkUserId = session.userId;

    const user = await usersService.resolveByClerkId(clerkUserId);

    const result = await dispatchService.recreate(orgId, dispatchId, user.id);

    return Response.json(result, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
