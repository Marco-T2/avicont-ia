import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
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
    const { orgSlug, payableId } = await params;
    const { orgId } = await requirePermission("purchases", "write", orgSlug);

    const body = await request.json();
    const input = payableStatusSchema.parse(body);

    const payable = await payablesService.updateStatus(orgId, payableId, input);

    return Response.json(payable);
  } catch (error) {
    return handleError(error);
  }
}
