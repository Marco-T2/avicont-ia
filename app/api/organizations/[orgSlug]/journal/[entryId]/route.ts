import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { JournalService } from "@/features/accounting";

const service = new JournalService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; entryId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, entryId } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["admin", "contador"]);

    const entry = await service.getById(orgId, entryId);

    return Response.json(entry);
  } catch (error) {
    return handleError(error);
  }
}
