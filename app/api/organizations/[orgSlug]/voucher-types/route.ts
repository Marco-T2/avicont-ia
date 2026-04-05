import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { VoucherTypesService } from "@/features/voucher-types";

const service = new VoucherTypesService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

    const types = await service.list(orgId);

    return Response.json(types);
  } catch (error) {
    return handleError(error);
  }
}
