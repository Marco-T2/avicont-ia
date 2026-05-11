import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import {
  makeProductTypeService,
  updateProductTypeSchema,
} from "@/modules/product-type/presentation/server";

const service = makeProductTypeService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; productTypeId: string }> },
) {
  try {
    const { orgSlug, productTypeId } = await params;
    const { orgId } = await requirePermission("accounting-config", "read", orgSlug);

    const productType = await service.getById(orgId, productTypeId);

    return Response.json(productType.toSnapshot());
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; productTypeId: string }> },
) {
  try {
    const { orgSlug, productTypeId } = await params;
    const { orgId } = await requirePermission("accounting-config", "write", orgSlug);

    const body = await request.json();
    const input = updateProductTypeSchema.parse(body);

    const updated = await service.update(orgId, productTypeId, input);

    return Response.json(updated.toSnapshot());
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; productTypeId: string }> },
) {
  try {
    const { orgSlug, productTypeId } = await params;
    const { orgId } = await requirePermission("accounting-config", "write", orgSlug);

    const deactivated = await service.deactivate(orgId, productTypeId);

    return Response.json(deactivated.toSnapshot());
  } catch (error) {
    return handleError(error);
  }
}
