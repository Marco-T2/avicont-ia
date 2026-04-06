import { z } from "zod";
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

const dispatchActionSchema = z.object({
  status: z.enum(["POSTED", "VOIDED"]),
  justification: z.string().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; dispatchId: string }> },
) {
  try {
    const { userId: clerkUserId } = await requireAuth();
    const { orgSlug, dispatchId } = await params;
    const orgId = await requireOrgAccess(clerkUserId, orgSlug);
    await requireRole(clerkUserId, orgId, ["owner", "admin", "contador"]);

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
