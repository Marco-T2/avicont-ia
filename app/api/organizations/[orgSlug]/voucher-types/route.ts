import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import {
  makeVoucherTypesService,
  createVoucherTypeSchema,
} from "@/modules/voucher-types/presentation/server";

const service = makeVoucherTypesService();

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

    const types = (await service.list(orgId, options)).map((vt) =>
      vt.toSnapshot(),
    );

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

    const created = (await service.create(orgId, input)).toSnapshot();

    return Response.json(created, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
