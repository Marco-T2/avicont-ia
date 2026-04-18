import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { FiscalPeriodsService } from "@/features/fiscal-periods";
import { closeFiscalPeriodSchema } from "@/features/fiscal-periods";

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
    const { orgSlug, periodId } = await params;
    const { orgId } = await requirePermission("accounting-config", "write", orgSlug);

    const body = await request.json();
    closeFiscalPeriodSchema.parse(body);

    const period = await service.close(orgId, periodId);

    return Response.json(period);
  } catch (error) {
    return handleError(error);
  }
}
