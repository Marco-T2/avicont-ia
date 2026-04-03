import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { LedgerService } from "@/features/accounting";
import { dateRangeSchema } from "@/features/accounting/accounting.validation";

const service = new LedgerService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["admin", "contador"]);

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    if (accountId) {
      const dateRange = dateRangeSchema.parse({
        dateFrom: searchParams.get("dateFrom") ?? undefined,
        dateTo: searchParams.get("dateTo") ?? undefined,
      });

      const ledger = await service.getAccountLedger(orgId, accountId, dateRange);
      return Response.json(ledger);
    }

    const dateParam = searchParams.get("date");
    const date = dateParam ? new Date(dateParam) : undefined;

    const trialBalance = await service.getTrialBalance(orgId, date);
    return Response.json(trialBalance);
  } catch (error) {
    return handleError(error);
  }
}
