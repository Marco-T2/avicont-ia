import { handleError } from "@/modules/shared/presentation/middleware";
import { requirePermission } from "@/modules/permissions/application/server";
import { makeAuditReads } from "@/modules/audit/presentation/server";

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

    // Registros del evento de cierre via tenant-scoped read port del módulo
    // audit (audit-pure-read Group B). Ya llegan ordenados por entityType +
    // createdAt.
    const rows = await makeAuditReads().closeEvents.listByCorrelation(
      orgId,
      correlationId,
    );

    return Response.json(rows);
  } catch (error) {
    return handleError(error);
  }
}
