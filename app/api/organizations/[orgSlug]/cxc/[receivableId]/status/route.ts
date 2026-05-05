import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import {
  makeReceivablesService,
  attachContact,
} from "@/modules/receivables/presentation/server";
import { receivableStatusSchema } from "@/modules/receivables/presentation/validation";

const receivablesService = makeReceivablesService();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; receivableId: string }> },
) {
  try {
    const { orgSlug, receivableId } = await params;
    const { orgId } = await requirePermission("sales", "write", orgSlug);

    const body = await request.json();
    const input = receivableStatusSchema.parse(body);

    const item = await receivablesService.transitionStatus(orgId, receivableId, input);
    const receivable = await attachContact(orgId, item);

    return Response.json(receivable);
  } catch (error) {
    return handleError(error);
  }
}
