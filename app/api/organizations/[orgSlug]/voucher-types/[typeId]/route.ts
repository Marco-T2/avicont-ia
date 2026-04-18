import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { VoucherTypesService } from "@/features/voucher-types";
import { updateVoucherTypeSchema } from "@/features/voucher-types/voucher-types.validation";

const service = new VoucherTypesService();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; typeId: string }> },
) {
  try {
    const { orgSlug, typeId } = await params;
    const { orgId } = await requirePermission("accounting-config", "write", orgSlug);

    const body = await request.json();
    const input = updateVoucherTypeSchema.parse(body);

    const updated = await service.update(orgId, typeId, input);

    return Response.json(updated);
  } catch (error) {
    return handleError(error);
  }
}
