import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { DispatchService } from "@/modules/dispatch/presentation/server";
import { updateDispatchSchema } from "@/modules/dispatch/presentation";

const dispatchService = new DispatchService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; dispatchId: string }> },
) {
  try {
    const { orgSlug, dispatchId } = await params;
    const { orgId } = await requirePermission("dispatches", "read", orgSlug);

    const dispatch = await dispatchService.getById(orgId, dispatchId);

    return Response.json(dispatch);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; dispatchId: string }> },
) {
  try {
    const { orgSlug, dispatchId } = await params;
    const { session, orgId, role } = await requirePermission(
      "dispatches",
      "write",
      orgSlug,
    );
    const userId = session.userId;

    const body = await request.json();
    const { justification, ...rest } = body;
    const input = updateDispatchSchema.parse(rest);

    const dispatch = await dispatchService.update(orgId, dispatchId, input, role, justification, userId);

    return Response.json(dispatch);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; dispatchId: string }> },
) {
  try {
    const { orgSlug, dispatchId } = await params;
    const { orgId } = await requirePermission("dispatches", "write", orgSlug);

    await dispatchService.hardDelete(orgId, dispatchId);

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
}
