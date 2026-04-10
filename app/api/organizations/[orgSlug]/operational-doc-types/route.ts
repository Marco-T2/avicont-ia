import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import {
  OperationalDocTypesService,
  createOperationalDocTypeSchema,
} from "@/features/operational-doc-types";
import { OperationalDocDirection } from "@/generated/prisma/client";

const service = new OperationalDocTypesService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

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
    const { userId } = await requireAuth();
    const { orgSlug } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

    const body = await request.json();
    const input = createOperationalDocTypeSchema.parse(body);

    const docType = await service.create(orgId, input);

    return Response.json(docType, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
