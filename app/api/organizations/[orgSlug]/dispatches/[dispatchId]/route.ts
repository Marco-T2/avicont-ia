import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { DispatchService } from "@/features/dispatch";
import { updateDispatchSchema } from "@/features/dispatch";

const dispatchService = new DispatchService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; dispatchId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, dispatchId } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

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
    const { userId } = await requireAuth();
    const { orgSlug, dispatchId } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    const member = await requireRole(userId, orgId, ["owner", "admin", "contador"]);

    const body = await request.json();
    const { justification, ...rest } = body;
    const input = updateDispatchSchema.parse(rest);

    const dispatch = await dispatchService.update(orgId, dispatchId, input, member.role, justification, userId);

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
    const { userId } = await requireAuth();
    const { orgSlug, dispatchId } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

    await dispatchService.hardDelete(orgId, dispatchId);

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
}
