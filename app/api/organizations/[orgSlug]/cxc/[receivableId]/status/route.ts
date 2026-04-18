import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
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
    const { orgSlug, receivableId } = await params;
    const { orgId } = await requirePermission("sales", "write", orgSlug);

    const body = await request.json();
    const input = receivableStatusSchema.parse(body);

    const receivable = await receivablesService.updateStatus(orgId, receivableId, input);

    return Response.json(receivable);
  } catch (error) {
    return handleError(error);
  }
}
