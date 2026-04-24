import { requireAuth, handleError } from "@/features/shared/middleware";
import { requireOrgAccess } from "@/features/organizations/server";
import { FarmsService } from "@/features/farms/server";
import { updateFarmSchema } from "@/features/farms";

const service = new FarmsService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; farmId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, farmId } = await params;
    const organizationId = await requireOrgAccess(userId, orgSlug);

    const farm = await service.getById(organizationId, farmId);

    return Response.json(farm);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; farmId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, farmId } = await params;
    const organizationId = await requireOrgAccess(userId, orgSlug);

    const body = await request.json();
    const input = updateFarmSchema.parse(body);

    const farm = await service.update(organizationId, farmId, input);

    return Response.json(farm);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; farmId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, farmId } = await params;
    const organizationId = await requireOrgAccess(userId, orgSlug);

    await service.delete(organizationId, farmId);

    return Response.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
