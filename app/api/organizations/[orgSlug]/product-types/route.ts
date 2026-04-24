import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { ProductTypesService } from "@/features/product-types/server";
import { createProductTypeSchema } from "@/features/product-types";

const service = new ProductTypesService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("accounting-config", "read", orgSlug);

    const { searchParams } = new URL(request.url);
    const isActiveParam = searchParams.get("isActive");
    const filters =
      isActiveParam !== null
        ? { isActive: isActiveParam === "true" }
        : undefined;

    const productTypes = await service.list(orgId, filters);

    return Response.json({ productTypes });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("accounting-config", "write", orgSlug);

    const body = await request.json();
    const input = createProductTypeSchema.parse(body);

    const productType = await service.create(orgId, input);

    return Response.json(productType, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
