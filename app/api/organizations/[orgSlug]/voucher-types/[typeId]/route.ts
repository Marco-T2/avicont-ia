import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { VoucherTypesService } from "@/features/voucher-types";
import { updateVoucherTypeSchema } from "@/features/voucher-types/voucher-types.validation";

const service = new VoucherTypesService();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; typeId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, typeId } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["admin"]);

    const body = await request.json();
    const input = updateVoucherTypeSchema.parse(body);

    const updated = await service.update(orgId, typeId, input);

    return Response.json(updated);
  } catch (error) {
    return handleError(error);
  }
}
