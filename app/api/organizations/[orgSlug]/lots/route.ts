import { requireAuth, handleError } from "@/features/shared/middleware";
import { requireOrgAccess } from "@/features/organizations/server";
import { makeLotService } from "@/modules/lot/presentation/server";
import { createLotSchema } from "@/modules/lot/presentation/validation";
import type { NextRequest } from "next/server";

const service = makeLotService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug } = await params;
    const organizationId = await requireOrgAccess(userId, orgSlug);

    const farmId = request.nextUrl.searchParams.get("farmId");

    const lots = farmId
      ? await service.listByFarm(organizationId, farmId)
      : await service.list(organizationId);

    return Response.json(lots);
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
    const input = createLotSchema.parse(body);

    const lot = await service.create(organizationId, input);

    return Response.json(lot, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
