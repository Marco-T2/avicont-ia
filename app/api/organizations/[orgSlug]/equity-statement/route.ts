import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import {
  makeEquityStatementService,
  equityStatementQuerySchema,
  exportEquityStatementPdf,
  exportEquityStatementXlsx,
} from "@/modules/accounting/equity-statement/presentation/server";
import { serializeStatement } from "@/modules/accounting/financial-statements/presentation/server";
import type { Role } from "@/features/permissions";

// Node.js runtime required by pdfmake + exceljs (Buffer/streams)
export const runtime = "nodejs";

const service = makeEquityStatementService();

/**
 * GET /api/organizations/[orgSlug]/equity-statement
 *
 * Genera el Estado de Evolución del Patrimonio Neto para un rango de fechas.
 *
 * Query params:
 * - dateFrom (YYYY-MM-DD): requerido
 * - dateTo   (YYYY-MM-DD): requerido
 * - format (opcional): "json" | "pdf" | "xlsx" — por defecto "json"
 *
 * C4 cutover (design §9.1 Option A, AXIS-DISTINCT vs TB):
 * - Route uses makeEquityStatementService() factory — no direct service instantiation.
 * - repo.getOrgMetadata(orgId) → service.getOrgMetadata(orgId) (service delegates to port).
 * - Direct infra reference removed from route (composition-root handles wiring).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId, role } = await requirePermission("reports", "read", orgSlug);
    const userRole = role as Role;

    const { searchParams } = new URL(request.url);
    const query = equityStatementQuerySchema.parse({
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo:   searchParams.get("dateTo")   ?? undefined,
      format:   searchParams.get("format")   ?? undefined,
    });

    const statement = await service.generate(orgId, userRole, {
      dateFrom: new Date(query.dateFrom),
      dateTo:   new Date(query.dateTo),
    });

    const periodLabel = `${query.dateFrom}_${query.dateTo}`.replace(/[^a-zA-Z0-9_-]/g, "-");

    if (query.format === "pdf") {
      const orgMeta = await service.getOrgMetadata(orgId);
      const { buffer } = await exportEquityStatementPdf(
        statement,
        orgMeta?.name ?? orgSlug,
        orgMeta?.taxId ?? undefined,
        orgMeta?.address ?? undefined,
        orgMeta?.city ?? undefined,
      );
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          // inline → browser renderiza en pestaña nueva, filename preservado.
          "Content-Disposition": `inline; filename="eepn-${orgSlug}-${periodLabel}.pdf"`,
        },
      });
    }

    if (query.format === "xlsx") {
      const orgMeta = await service.getOrgMetadata(orgId);
      const buffer = await exportEquityStatementXlsx(
        statement,
        orgMeta?.name ?? orgSlug,
        orgMeta?.taxId ?? undefined,
        orgMeta?.address ?? undefined,
      );
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="eepn-${orgSlug}-${periodLabel}.xlsx"`,
        },
      });
    }

    return Response.json(serializeStatement(statement));
  } catch (error) {
    return handleError(error);
  }
}
