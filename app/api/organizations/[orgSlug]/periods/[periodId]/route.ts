import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { LEGACY_CLOSE_REMOVED } from "@/features/shared/errors";
import { FiscalPeriodsService } from "@/features/fiscal-periods/server";

const service = new FiscalPeriodsService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; periodId: string }> },
) {
  try {
    const { orgSlug, periodId } = await params;
    const { orgId } = await requirePermission("accounting-config", "read", orgSlug);

    const period = await service.getById(orgId, periodId);

    return Response.json(period);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; periodId: string }> },
) {
  try {
    const { orgSlug } = await params;
    await requirePermission("accounting-config", "write", orgSlug);

    const body = await request.json();
    if (body?.status === "CLOSED") {
      return Response.json(
        {
          code: LEGACY_CLOSE_REMOVED,
          newEndpoint: "POST /api/organizations/{orgSlug}/monthly-close",
        },
        { status: 410 },
      );
    }

    return Response.json(
      { code: "VALIDATION", error: "Operación no soportada en este endpoint" },
      { status: 400 },
    );
  } catch (error) {
    return handleError(error);
  }
}
