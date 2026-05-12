import { requireAuth, handleError } from "@/features/shared/middleware";
import { requireOrgAccess } from "@/modules/organizations/presentation/server";
import { makeFarmService } from "@/modules/farm/presentation/server";
import { createFarmSchema } from "@/modules/farm/presentation/validation";

const service = makeFarmService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug } = await params;
    const organizationId = await requireOrgAccess(userId, orgSlug);

    const farms = await service.list(organizationId);

    return Response.json(farms);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug } = await params;
    const organizationId = await requireOrgAccess(userId, orgSlug);

    const body = await request.json();
    const input = createFarmSchema.parse(body);

    const farm = await service.create(organizationId, input);

    return Response.json(farm, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
