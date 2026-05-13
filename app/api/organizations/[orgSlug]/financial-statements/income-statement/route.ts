import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { makeFinancialStatementsService } from "@/modules/accounting/financial-statements/presentation/server";
import { serializeStatement } from "@/modules/accounting/financial-statements/presentation";
import { incomeStatementQuerySchema } from "@/modules/accounting/financial-statements/presentation/server";
import type { Role } from "@/features/permissions";

// Node.js runtime requerido por los exporters de PR4 (pdfmake + exceljs usan Buffer/streams nativos)
export const runtime = "nodejs";

const service = makeFinancialStatementsService();

/**
 * GET /api/organizations/[orgSlug]/financial-statements/income-statement
 *
 * Genera el Estado de Resultados para un período fiscal o rango de fechas.
 *
 * Query params (mutuamente excluyentes — se prefiere periodId si se proveen ambos):
 * - periodId (opcional): ID del período fiscal; deriva dateFrom/dateTo del registro
 * - dateFrom + dateTo (requeridos si no hay periodId): rango de fechas YYYY-MM-DD
 * - format (opcional): "json" | "pdf" | "xlsx" — por defecto "json" (pdf/xlsx en PR4)
 *
 * Respuestas:
 * - 200: Estado de Resultados serializado (Decimals como strings)
 * - 400: Query params inválidos (Zod) — incluye falta de periodId Y rango de fechas
 * - 401: Sin sesión Clerk
 * - 403: Rol no permitido (member)
 * - 404: Período fiscal no encontrado
 * - 500: Error interno
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    // 1-3. Autenticación + membresía + rol (via requirePermission)
    const { orgSlug } = await params;
    const { orgId, role } = await requirePermission("reports", "read", orgSlug);
    const userRole = role as Role;

    // 4. Validar query params con Zod (incluye refine dateFrom <= dateTo y nuevos params PR2)
    const { searchParams } = new URL(request.url);
    const query = incomeStatementQuerySchema.parse({
      periodId: searchParams.get("periodId") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      format: searchParams.get("format") ?? undefined,
      preset: searchParams.get("preset") ?? undefined,
      breakdownBy: searchParams.get("breakdownBy") ?? undefined,
      compareWith: searchParams.get("compareWith") ?? undefined,
      compareDateFrom: searchParams.get("compareDateFrom") ?? undefined,
      compareDateTo: searchParams.get("compareDateTo") ?? undefined,
    });

    const incomeInput = {
      fiscalPeriodId: query.periodId,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      preset: query.preset,
      breakdownBy: query.breakdownBy,
      compareWith: query.compareWith,
      compareDateFrom: query.compareDateFrom ? new Date(query.compareDateFrom) : undefined,
      compareDateTo: query.compareDateTo ? new Date(query.compareDateTo) : undefined,
    };

    // Sanitiza el periodLabel para nombres de archivo seguros:
    // {type}-{orgSlug}-{periodLabel}.{ext}
    const rawPeriodLabel = query.dateFrom
      ? `${query.dateFrom}_${query.dateTo}`
      : (query.periodId ?? "periodo");
    const periodLabel = rawPeriodLabel.replace(/[^a-zA-Z0-9\-_]/g, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "");

    // 5a. Respuesta en formato PDF
    if (query.format === "pdf") {
      const buffer = await service.exportIncomeStatementPdf(orgId, userRole, incomeInput, orgSlug);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="estado-resultados-${orgSlug}-${periodLabel}.pdf"`,
        },
      });
    }

    // 5b. Respuesta en formato Excel
    if (query.format === "xlsx") {
      const buffer = await service.exportIncomeStatementXlsx(
        orgId,
        userRole,
        incomeInput,
        orgSlug,
      );
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="estado-resultados-${orgSlug}-${periodLabel}.xlsx"`,
        },
      });
    }

    // 5c. Respuesta JSON (default)
    const statement = await service.generateIncomeStatement(orgId, userRole, incomeInput);

    // 6. Serializar Decimals → strings en la frontera (REQ-10, D9)
    return Response.json(serializeStatement(statement));
  } catch (error) {
    return handleError(error);
  }
}
