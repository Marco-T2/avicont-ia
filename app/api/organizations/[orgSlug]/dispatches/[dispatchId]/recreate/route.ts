import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/modules/permissions/application/server";
import { UsersService } from "@/modules/users/application/users.service";
import { makeDispatchService } from "@/modules/dispatch/presentation/server";

const usersService = new UsersService();
const dispatchService = makeDispatchService();

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
