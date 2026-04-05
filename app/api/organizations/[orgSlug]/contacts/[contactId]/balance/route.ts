import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { ContactsService } from "@/features/contacts";
import { ReceivablesService } from "@/features/receivables";
import { PayablesService } from "@/features/payables";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; contactId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, contactId } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

    const contactsService = new ContactsService();
    const receivablesService = new ReceivablesService(contactsService);
    const payablesService = new PayablesService(contactsService);
    contactsService.setReceivablesService(receivablesService);
    contactsService.setPayablesService(payablesService);

    const balance = await contactsService.getBalanceSummary(orgId, contactId);

    return Response.json(balance);
  } catch (error) {
    return handleError(error);
  }
}
