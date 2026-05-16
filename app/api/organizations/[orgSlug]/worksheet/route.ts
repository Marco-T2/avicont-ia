import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import {
  WorksheetService,
  makeWorksheetService,
  worksheetQuerySchema,
  exportWorksheetPdf,
  exportWorksheetXlsx,
} from "@/modules/accounting/worksheet/presentation/server";
import { PrismaWorksheetRepo } from "@/modules/accounting/worksheet/infrastructure/prisma-worksheet.repo";
import { serializeStatement } from "@/modules/accounting/financial-statements/presentation/server";
import type { Role } from "@/features/permissions";

// Node.js runtime required by pdfmake + exceljs (Buffer/streams)
export const runtime = "nodejs";

const service = makeWorksheetService();
const repo = new PrismaWorksheetRepo();

/**
 * GET /api/organizations/[orgSlug]/worksheet
 *
 * Genera la Hoja de Trabajo 12 Columnas para un rango de fechas o período fiscal.
 *
 * Query params:
 * - dateFrom (YYYY-MM-DD): requerido si no hay fiscalPeriodId
 * - dateTo   (YYYY-MM-DD): requerido si no hay fiscalPeriodId
 * - fiscalPeriodId (opcional): usa rango del período; se intersecta con dateFrom/dateTo si ambos presentes
 * - format (opcional): "json" | "pdf" | "xlsx" — por defecto "json"
 *
 * Respuestas:
 * - 200: Hoja de Trabajo serializada (Decimals como strings en JSON; Buffer en PDF/XLSX)
 * - 400: Query params inválidos (Zod)
 * - 401: Sin sesión Clerk
 * - 403: Rol no permitido (viewer / member)
 * - 404: Período fiscal no encontrado
 * - 500: Error interno
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    // 1. Auth + RBAC gate
    const { orgSlug } = await params;
    const { orgId, role } = await requirePermission("reports", "read", orgSlug);
    const userRole = role as Role;

    // 2. Validate query params
    const { searchParams } = new URL(request.url);
    const query = worksheetQuerySchema.parse({
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      fiscalPeriodId: searchParams.get("fiscalPeriodId") ?? undefined,
      format: searchParams.get("format") ?? undefined,
    });

    // 3. Resolve date range — if no dates, use wide range to let period drive it
    const dateFrom = query.dateFrom
      ? new Date(query.dateFrom)
      : new Date("1900-01-01");
    const dateTo = query.dateTo
      ? new Date(query.dateTo)
      : new Date("2099-12-31");

    const filters = {
      dateFrom,
      dateTo,
      fiscalPeriodId: query.fiscalPeriodId,
    };

    // 4. Generate report (RBAC double-check happens inside service)
    const report = await service.generateWorksheet(orgId, userRole, filters);

    // 5. Sanitize period label for filenames
    const rawLabel = query.dateFrom
      ? `${query.dateFrom}_${query.dateTo ?? "sin-fecha"}`
      : (query.fiscalPeriodId ?? "periodo");
    const periodLabel = rawLabel
      .replace(/[^a-zA-Z0-9\-_]/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "");

    // 6a. PDF response — inline para que el browser lo renderice en pestaña nueva
    if (query.format === "pdf") {
      const orgMeta = await repo.getOrgMetadata(orgId);
      const orgDisplayName = orgMeta?.name ?? orgSlug;
      const { buffer } = await exportWorksheetPdf(
        report,
        orgDisplayName,
        orgMeta?.taxId ?? undefined,
        orgMeta?.address ?? undefined,
        orgMeta?.city ?? undefined,
      );
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="hoja-de-trabajo-${orgSlug}-${periodLabel}.pdf"`,
        },
      });
    }

    // 6b. XLSX response
    if (query.format === "xlsx") {
      const buffer = await exportWorksheetXlsx(report, orgSlug);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="hoja-de-trabajo-${orgSlug}-${periodLabel}.xlsx"`,
        },
      });
    }

    // 6c. JSON response (default)
    return Response.json(serializeStatement(report));
  } catch (error) {
    return handleError(error);
  }
}
