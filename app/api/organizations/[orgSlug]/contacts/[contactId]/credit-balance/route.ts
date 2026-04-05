import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { ContactsService } from "@/features/contacts";

const service = new ContactsService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; contactId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, contactId } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

    const creditBalance = await service.getCreditBalance(orgId, contactId);

    return Response.json({ creditBalance });
  } catch (error) {
    return handleError(error);
  }
}
