import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { ContactsService } from "@/features/contacts";

const service = new ContactsService();

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
