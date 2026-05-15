import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import {
  makeJournalsService,
  lastReferenceQuerySchema,
} from "@/modules/accounting/presentation/server";

const service = makeJournalsService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("journal", "read", orgSlug);

    const { searchParams } = new URL(request.url);
    const { voucherTypeId, periodId } = lastReferenceQuerySchema.parse({
      voucherTypeId: searchParams.get("voucherTypeId") ?? undefined,
      periodId: searchParams.get("periodId") ?? undefined,
    });

    const lastReferenceNumber = await service.getLastReferenceNumber(
      orgId,
      voucherTypeId,
    );

    let nextNumber: number | null = null;
    if (periodId) {
      nextNumber = await service.getNextNumber(orgId, voucherTypeId, periodId);
    }

    return Response.json({ lastReferenceNumber, nextNumber });
  } catch (error) {
    return handleError(error);
  }
}
