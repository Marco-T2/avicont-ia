import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { ContactsService } from "@/features/contacts";
import { ReceivablesService } from "@/features/receivables";
import { receivableStatusSchema } from "@/features/receivables";

const contactsService = new ContactsService();
const receivablesService = new ReceivablesService(contactsService);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; receivableId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, receivableId } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

    const body = await request.json();
    const input = receivableStatusSchema.parse(body);

    const receivable = await receivablesService.updateStatus(orgId, receivableId, input);

    return Response.json(receivable);
  } catch (error) {
    return handleError(error);
  }
}
