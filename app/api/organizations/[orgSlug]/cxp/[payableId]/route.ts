import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import {
  makePayablesService,
  attachContact,
} from "@/modules/payables/presentation/server";
import { updatePayableSchema } from "@/modules/payables/presentation/validation";

const payablesService = makePayablesService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; payableId: string }> },
) {
  try {
    const { orgSlug, payableId } = await params;
    const { orgId } = await requirePermission("purchases", "read", orgSlug);

    const item = await payablesService.getById(orgId, payableId);
    const payable = await attachContact(orgId, item);

    return Response.json(payable);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; payableId: string }> },
) {
  try {
    const { orgSlug, payableId } = await params;
    const { orgId } = await requirePermission("purchases", "write", orgSlug);

    const body = await request.json();
    const input = updatePayableSchema.parse(body);

    const item = await payablesService.update(orgId, payableId, input);
    const payable = await attachContact(orgId, item);

    return Response.json(payable);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; payableId: string }> },
) {
  try {
    const { orgSlug, payableId } = await params;
    const { orgId } = await requirePermission("purchases", "write", orgSlug);

    const item = await payablesService.void(orgId, payableId);
    const payable = await attachContact(orgId, item);

    return Response.json(payable);
  } catch (error) {
    return handleError(error);
  }
}
