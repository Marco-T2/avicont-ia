import { handleError } from "@/modules/shared/presentation/middleware";
import { requirePermission } from "@/modules/permissions/application/server";
import { makeContactBalancesService } from "@/modules/contact-balances/presentation/server";

const service = makeContactBalancesService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; contactId: string }> },
) {
  try {
    const { orgSlug, contactId } = await params;
    const { orgId } = await requirePermission("contacts", "read", orgSlug);

    const creditBalance = await service.getCreditBalance(orgId, contactId);

    return Response.json({ creditBalance });
  } catch (error) {
    return handleError(error);
  }
}
