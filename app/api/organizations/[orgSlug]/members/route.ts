import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { makeMembersService, buildAddMemberSchema } from "@/modules/organizations/presentation/server";

const service = makeMembersService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId: organizationId } = await requirePermission(
      "members",
      "read",
      orgSlug,
    );

    const members = await service.listMembers(organizationId);

    return Response.json(members);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId: organizationId } = await requirePermission(
      "members",
      "write",
      orgSlug,
    );

    const body = await request.json();
    // PR6.2 / D.9 — factory-based async validation: role slug is resolved
    // against the org's CustomRole table via rolesService.exists. parseAsync
    // is MANDATORY because the schema contains async refinements.
    const input = await buildAddMemberSchema(organizationId).parseAsync(body);

    const member = await service.addMember(
      organizationId,
      input.email,
      input.role,
    );

    return Response.json(member, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
