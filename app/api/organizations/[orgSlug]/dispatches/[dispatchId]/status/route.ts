import { z } from "zod";
import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { UsersService } from "@/features/users/server";
import { makeDispatchService } from "@/modules/dispatch/presentation/server";

const usersService = new UsersService();
const dispatchService = makeDispatchService();

const dispatchActionSchema = z.object({
  status: z.enum(["POSTED", "VOIDED"]),
  justification: z.string().optional(),
});

export async function PATCH(
  request: Request,
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

    const body = await request.json();
    const { status, justification } = dispatchActionSchema.parse(body);

    const user = await usersService.resolveByClerkId(clerkUserId);

    let dispatch;
    if (status === "POSTED") {
      dispatch = await dispatchService.post(orgId, dispatchId, user.id);
    } else {
      dispatch = await dispatchService.voidDispatch(orgId, dispatchId, user.id, justification);
    }

    return Response.json(dispatch);
  } catch (error) {
    return handleError(error);
  }
}
