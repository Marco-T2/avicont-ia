import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import {
  makeReceivablesService,
  attachContact,
} from "@/modules/receivables/presentation/server";
import { updateReceivableSchema } from "@/modules/receivables/presentation/validation";

const receivablesService = makeReceivablesService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; receivableId: string }> },
) {
  try {
    const { orgSlug, receivableId } = await params;
    const { orgId } = await requirePermission("sales", "read", orgSlug);

    const item = await receivablesService.getById(orgId, receivableId);
    const receivable = await attachContact(orgId, item);

    return Response.json(receivable);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; receivableId: string }> },
) {
  try {
    const { orgSlug, receivableId } = await params;
    const { orgId } = await requirePermission("sales", "write", orgSlug);

    const body = await request.json();
    const input = updateReceivableSchema.parse(body);

    const item = await receivablesService.update(orgId, receivableId, input);
    const receivable = await attachContact(orgId, item);

    return Response.json(receivable);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; receivableId: string }> },
) {
  try {
    const { orgSlug, receivableId } = await params;
    const { orgId } = await requirePermission("sales", "write", orgSlug);

    const item = await receivablesService.void(orgId, receivableId);
    const receivable = await attachContact(orgId, item);

    return Response.json(receivable);
  } catch (error) {
    return handleError(error);
  }
}
