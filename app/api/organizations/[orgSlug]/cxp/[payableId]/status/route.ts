import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { ContactsService } from "@/features/contacts";
import { PayablesService } from "@/features/payables";
import { payableStatusSchema } from "@/features/payables";

const contactsService = new ContactsService();
const payablesService = new PayablesService(contactsService);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; payableId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, payableId } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

    const body = await request.json();
    const input = payableStatusSchema.parse(body);

    const payable = await payablesService.updateStatus(orgId, payableId, input);

    return Response.json(payable);
  } catch (error) {
    return handleError(error);
  }
}
