import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("period", "read", orgSlug);

    const { searchParams } = new URL(request.url);
    const correlationId = searchParams.get("correlationId");

    if (!correlationId) {
      return Response.json(
        { error: "correlationId requerido", code: "VALIDATION" },
        { status: 400 },
      );
    }

    const rows = await prisma.auditLog.findMany({
      where: { organizationId: orgId, correlationId },
      orderBy: [{ entityType: "asc" }, { createdAt: "asc" }],
    });

    return Response.json(rows);
  } catch (error) {
    return handleError(error);
  }
}
