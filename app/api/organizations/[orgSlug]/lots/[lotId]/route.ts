import { requireAuth, handleError } from "@/features/shared/middleware";
import { requireOrgAccess } from "@/features/organizations/server";
import { LotsService } from "@/features/lots/server";
import { closeLotSchema } from "@/features/lots";

const service = new LotsService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; lotId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, lotId } = await params;
    const organizationId = await requireOrgAccess(userId, orgSlug);

    const summary = await service.getSummary(organizationId, lotId);

    return Response.json(summary);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; lotId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, lotId } = await params;
    const organizationId = await requireOrgAccess(userId, orgSlug);

    const body = await request.json();
    const input = closeLotSchema.parse(body);

    const lot = await service.close(organizationId, lotId, input);

    return Response.json(lot);
  } catch (error) {
    return handleError(error);
  }
}
