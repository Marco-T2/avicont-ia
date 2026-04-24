import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { MembersService } from "@/features/organizations/server";
import { buildUpdateMemberRoleSchema } from "@/features/organizations/server";

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
    // PR6.2 / D.9 — factory-based async validation: role slug is resolved
    // against the org's CustomRole table via rolesService.exists. parseAsync
    // is MANDATORY because the schema contains async refinements.
    const input = await buildUpdateMemberRoleSchema(organizationId).parseAsync(
      body,
    );

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
