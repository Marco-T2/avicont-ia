import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { JournalService } from "@/features/accounting";
import { lastReferenceQuerySchema } from "@/features/accounting/accounting.validation";

const service = new JournalService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

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
