import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { VoucherTypesService } from "@/features/voucher-types/server";
import { createVoucherTypeSchema } from "@/features/voucher-types/server";

const service = new VoucherTypesService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("accounting-config", "read", orgSlug);

    const { searchParams } = new URL(request.url);
    const activeParam = searchParams.get("active");
    const options = {
      ...(activeParam === "true" && { isActive: true }),
      includeCounts: true,
    };

    const types = await service.list(orgId, options);

    return Response.json(types);
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
    const input = createVoucherTypeSchema.parse(body);

    const created = await service.create(orgId, input);

    return Response.json(created, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
