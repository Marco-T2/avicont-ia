import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { LedgerService } from "@/features/accounting";
import { dateRangeSchema } from "@/features/accounting/accounting.validation";
import { ValidationError } from "@/features/shared/errors";

const service = new LedgerService();

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
    const accountId = searchParams.get("accountId");
    const periodId = searchParams.get("periodId") ?? undefined;

    if (accountId) {
      const dateRange = dateRangeSchema.parse({
        dateFrom: searchParams.get("dateFrom") ?? undefined,
        dateTo: searchParams.get("dateTo") ?? undefined,
      });

      const ledger = await service.getAccountLedger(
        orgId,
        accountId,
        dateRange,
        periodId,
      );
      return Response.json(ledger);
    }

    if (!periodId) {
      throw new ValidationError("periodId es requerido para el balance de comprobación");
    }

    const trialBalance = await service.getTrialBalance(orgId, periodId);
    return Response.json(trialBalance);
  } catch (error) {
    return handleError(error);
  }
}
