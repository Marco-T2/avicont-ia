import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import {
  makePayablesService,
  attachContact,
} from "@/modules/payables/presentation/server";
import { payableStatusSchema } from "@/features/payables";

const payablesService = makePayablesService();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; payableId: string }> },
) {
  try {
    const { orgSlug, payableId } = await params;
    const { orgId } = await requirePermission("purchases", "write", orgSlug);

    const body = await request.json();
    const input = payableStatusSchema.parse(body);

    const item = await payablesService.transitionStatus(orgId, payableId, input);
    const payable = await attachContact(orgId, item);

    return Response.json(payable);
  } catch (error) {
    return handleError(error);
  }
}
