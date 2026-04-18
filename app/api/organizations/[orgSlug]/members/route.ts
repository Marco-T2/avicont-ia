import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { MembersService, addMemberSchema } from "@/features/organizations";

const service = new MembersService();

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
    const input = addMemberSchema.parse(body);

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
