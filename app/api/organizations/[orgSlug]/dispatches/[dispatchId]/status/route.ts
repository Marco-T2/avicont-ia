import { z } from "zod";
import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { UsersService } from "@/features/shared/users.service";
import { DispatchService } from "@/features/dispatch";

const usersService = new UsersService();
const dispatchService = new DispatchService();

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
      dispatch = await dispatchService.void(orgId, dispatchId, user.id, justification);
    }

    return Response.json(dispatch);
  } catch (error) {
    return handleError(error);
  }
}
