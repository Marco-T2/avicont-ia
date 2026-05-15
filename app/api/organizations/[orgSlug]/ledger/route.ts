import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import {
  makeLedgerService,
  dateRangeSchema,
} from "@/modules/accounting/presentation/server";
import { ValidationError } from "@/features/shared/errors";
import { parsePaginationParams } from "@/modules/shared/presentation/parse-pagination-params";

const service = makeLedgerService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("reports", "read", orgSlug);

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const periodId = searchParams.get("periodId") ?? undefined;

    if (accountId) {
      const dateRange = dateRangeSchema.parse({
        dateFrom: searchParams.get("dateFrom") ?? undefined,
        dateTo: searchParams.get("dateTo") ?? undefined,
      });
      const pagination = parsePaginationParams(searchParams);

      // D-Route LOCKED: always paginated when accountId present, defaults
      // applied per design §4.1. API contract changes from LedgerEntry[] to
      // LedgerPaginatedDto — sole consumer ledger-page-client.tsx rewritten
      // atomic same commit per [[mock_hygiene_commit_scope]].
      const ledger = await service.getAccountLedgerPaginated(
        orgId,
        accountId,
        dateRange,
        periodId,
        pagination,
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
