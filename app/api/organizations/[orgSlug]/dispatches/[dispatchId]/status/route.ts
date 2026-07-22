import { z } from "zod";
import { handleError } from "@/modules/shared/presentation/middleware";
import { requirePermission } from "@/modules/permissions/application/server";
import { makeUsersService } from "@/modules/users/presentation/composition-root";
import { makeDispatchService } from "@/modules/dispatch/presentation/server";

const usersService = makeUsersService();
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

    const { dispatch } =
      status === "POSTED"
        ? await dispatchService.post(orgId, dispatchId, user.id)
        : await dispatchService.voidDispatch(orgId, dispatchId, user.id, justification);

    return Response.json(dispatch.toSnapshot());
  } catch (error) {
    return handleError(error);
  }
}
