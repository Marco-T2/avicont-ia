import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { ValidationError } from "@/features/shared/errors";
import { AccountBalancesService } from "@/features/account-balances/server";

const service = new AccountBalancesService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("reports", "read", orgSlug);

    const { searchParams } = new URL(request.url);
    const periodId = searchParams.get("periodId");

    if (!periodId) {
      throw new ValidationError("El parámetro periodId es requerido");
    }

    const accountId = searchParams.get("accountId") ?? undefined;

    const balances = await service.getBalances(orgId, periodId, accountId);

    return Response.json(balances);
  } catch (error) {
    return handleError(error);
  }
}
