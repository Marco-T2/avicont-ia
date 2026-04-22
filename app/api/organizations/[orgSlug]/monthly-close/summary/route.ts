import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { MonthlyCloseService } from "@/features/monthly-close/server";

const service = new MonthlyCloseService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("period", "read", orgSlug);

    const { searchParams } = new URL(request.url);
    const periodId = searchParams.get("periodId");

    if (!periodId) {
      return Response.json(
        { error: "El parametro periodId es requerido", code: "VALIDATION" },
        { status: 400 },
      );
    }

    const summary = await service.getSummary(orgId, periodId);

    return Response.json(summary);
  } catch (error) {
    return handleError(error);
  }
}
