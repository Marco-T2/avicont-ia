import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { OperationalDocTypesService } from "@/features/operational-doc-types/server";
import { updateOperationalDocTypeSchema } from "@/features/operational-doc-types";
import { ConflictError } from "@/features/shared/errors";

const service = new OperationalDocTypesService();

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

    return Response.json(updated);
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

    return Response.json(deactivated);
  } catch (error) {
    if (error instanceof ConflictError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: 409 },
      );
    }
    return handleError(error);
  }
}
