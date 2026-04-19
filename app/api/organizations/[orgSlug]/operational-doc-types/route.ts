import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { OperationalDocTypesService } from "@/features/operational-doc-types/server";
import { createOperationalDocTypeSchema } from "@/features/operational-doc-types";
import { OperationalDocDirection } from "@/generated/prisma/client";

const service = new OperationalDocTypesService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("accounting-config", "read", orgSlug);

    const { searchParams } = new URL(request.url);
    const isActiveParam = searchParams.get("isActive");
    const directionParam = searchParams.get("direction");

    const filters = {
      ...(isActiveParam !== null && { isActive: isActiveParam === "true" }),
      ...(directionParam !== null && {
        direction: directionParam as OperationalDocDirection,
      }),
    };

    const docTypes = await service.list(
      orgId,
      Object.keys(filters).length > 0 ? filters : undefined,
    );

    return Response.json({ docTypes });
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
    const input = createOperationalDocTypeSchema.parse(body);

    const docType = await service.create(orgId, input);

    return Response.json(docType, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
