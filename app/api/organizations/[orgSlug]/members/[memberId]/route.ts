import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { MembersService, updateRoleSchema } from "@/features/organizations";

const service = new MembersService();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; memberId: string }> },
) {
  try {
    const { orgSlug, memberId } = await params;
    const { session, orgId: organizationId } = await requirePermission(
      "members",
      "write",
      orgSlug,
    );
    const userId = session.userId;

    const body = await request.json();
    const input = updateRoleSchema.parse(body);

    const member = await service.updateRole(
      organizationId,
      memberId,
      input.role,
      userId,
    );

    return Response.json(member);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; memberId: string }> },
) {
  try {
    const { orgSlug, memberId } = await params;
    const { session, orgId: organizationId } = await requirePermission(
      "members",
      "write",
      orgSlug,
    );
    const userId = session.userId;

    await service.removeMember(organizationId, memberId, userId);

    return Response.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
