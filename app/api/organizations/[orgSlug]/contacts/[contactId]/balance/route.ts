import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { makeContactBalancesService } from "@/modules/contact-balances/presentation/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; contactId: string }> },
) {
  try {
    const { orgSlug, contactId } = await params;
    const { orgId } = await requirePermission("contacts", "read", orgSlug);

    const contactsService = makeContactBalancesService();

    const balance = await contactsService.getBalanceSummary(orgId, contactId);

    return Response.json(balance);
  } catch (error) {
    return handleError(error);
  }
}
