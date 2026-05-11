import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import {
  makeOperationalDocTypeService,
  updateOperationalDocTypeSchema,
  OperationalDocTypeInUseError,
} from "@/modules/operational-doc-type/presentation/server";

const service = makeOperationalDocTypeService();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; docTypeId: string }> },
) {
  try {
    const { orgSlug, docTypeId } = await params;
    const { orgId } = await requirePermission("accounting-config", "write", orgSlug);

    const body = await request.json();
    const input = updateOperationalDocTypeSchema.parse(body);

    const updated = await service.update(orgId, docTypeId, input);

    return Response.json(updated.toSnapshot());
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; docTypeId: string }> },
) {
  try {
    const { orgSlug, docTypeId } = await params;
    const { orgId } = await requirePermission("accounting-config", "write", orgSlug);

    const deactivated = await service.deactivate(orgId, docTypeId);

    return Response.json(deactivated.toSnapshot());
  } catch (error) {
    if (error instanceof OperationalDocTypeInUseError) {
      return Response.json(
        { error: error.message },
        { status: 409 },
      );
    }
    return handleError(error);
  }
}
