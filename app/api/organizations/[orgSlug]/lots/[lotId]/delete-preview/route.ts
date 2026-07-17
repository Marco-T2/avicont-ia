// RBAC-EXCEPTION: Auth-only via requireOrgAccess; farms/lots/expenses/mortality
// NOT in frozen Resource union. Consistent with sibling /lots/[lotId] routes.
import { requireAuth, handleError } from "@/modules/shared/presentation/middleware";
import { requireOrgAccess } from "@/modules/organizations/presentation/server";
import { makeLotService } from "@/modules/lot/presentation/server";

const service = makeLotService();

/**
 * Returns counts of child records that would be cascade-deleted if
 * the granjero confirms the delete dialog. UI shows these counts
 * before invoking DELETE /lots/[lotId]. Spec REQ-102.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; lotId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, lotId } = await params;
    const organizationId = await requireOrgAccess(userId, orgSlug);

    const preview = await service.getDeletePreview(organizationId, lotId);

    return Response.json(preview);
  } catch (error) {
    return handleError(error);
  }
}
