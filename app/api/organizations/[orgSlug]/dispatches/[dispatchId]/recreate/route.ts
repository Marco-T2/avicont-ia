import { handleError } from "@/modules/shared/presentation/middleware";
import { requirePermission } from "@/modules/permissions/application/server";
import { makeUsersService } from "@/modules/users/presentation/composition-root";
import { makeDispatchService } from "@/modules/dispatch/presentation/server";

const usersService = makeUsersService();
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
