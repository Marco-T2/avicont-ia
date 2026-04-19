import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { JournalService } from "@/features/accounting/server";
import { correlationAuditQuerySchema } from "@/features/accounting/accounting.validation";

const service = new JournalService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("accounting-config", "read", orgSlug);

    const { searchParams } = new URL(request.url);
    const filters = correlationAuditQuerySchema.parse({
      voucherTypeId: searchParams.get("voucherTypeId") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
    });

    const result = await service.getCorrelationAudit(orgId, filters);

    return Response.json(result);
  } catch (error) {
    return handleError(error);
  }
}
