import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { FinancialStatementsService } from "@/features/accounting/financial-statements";
import { serializeStatement } from "@/features/accounting/financial-statements";
import { balanceSheetQuerySchema } from "@/features/accounting/financial-statements/financial-statements.validation";
import type { Role } from "@/features/shared/permissions";

// Node.js runtime requerido por los exporters de PR4 (pdfmake + exceljs usan Buffer/streams nativos)
export const runtime = "nodejs";

const service = new FinancialStatementsService();

/**
 * GET /api/organizations/[orgSlug]/financial-statements/balance-sheet
 *
 * Genera el Balance General (Estado de Situación Patrimonial) a la fecha de corte.
 *
 * Query params:
 * - date (requerido): fecha de corte en formato YYYY-MM-DD
 * - periodId (opcional): ID del período fiscal; permite usar snapshot si está cerrado
 * - format (opcional): "json" | "pdf" | "xlsx" — por defecto "json" (pdf/xlsx en PR4)
 *
 * Respuestas:
 * - 200: Balance General serializado (Decimals como strings)
 * - 400: Query params inválidos (Zod)
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
    // 1. Autenticación Clerk (REQ-13)
    const { userId } = await requireAuth();

    // 2. Resolver orgSlug → orgId y verificar membresía
    const { orgSlug } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);

    // 3. Verificar rol (solo owner, admin, contador — REQ-13)
    const member = await requireRole(userId, orgId, ["owner", "admin", "contador"]);
    const userRole = member.role as Role;

    // 4. Validar query params con Zod (incluye nuevos params PR2)
    const { searchParams } = new URL(request.url);
    const query = balanceSheetQuerySchema.parse({
      date: searchParams.get("date") ?? undefined,
      periodId: searchParams.get("periodId") ?? undefined,
      format: searchParams.get("format") ?? undefined,
      preset: searchParams.get("preset") ?? undefined,
      breakdownBy: searchParams.get("breakdownBy") ?? undefined,
      compareWith: searchParams.get("compareWith") ?? undefined,
      compareAsOfDate: searchParams.get("compareAsOfDate") ?? undefined,
    });

    const balanceInput = {
      asOfDate: new Date(query.date),
      fiscalPeriodId: query.periodId,
      preset: query.preset,
      breakdownBy: query.breakdownBy,
      compareWith: query.compareWith,
      compareAsOfDate: query.compareAsOfDate ? new Date(query.compareAsOfDate) : undefined,
    };

    // Sanitiza el periodLabel para nombres de archivo seguros
    const periodLabel = (query.date ?? "sin-fecha").replace(/[^a-zA-Z0-9\-_]/g, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "");

    // 5a. Respuesta en formato PDF
    if (query.format === "pdf") {
      const buffer = await service.exportBalanceSheetPdf(orgId, userRole, balanceInput, orgSlug);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="balance-general-${orgSlug}-${periodLabel}.pdf"`,
        },
      });
    }

    // 5b. Respuesta en formato Excel
    if (query.format === "xlsx") {
      const buffer = await service.exportBalanceSheetXlsx(orgId, userRole, balanceInput, orgSlug);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="balance-general-${orgSlug}-${periodLabel}.xlsx"`,
        },
      });
    }

    // 5c. Respuesta JSON (default)
    const statement = await service.generateBalanceSheet(orgId, userRole, balanceInput);

    // 6. Serializar Decimals → strings en la frontera (REQ-10, D9)
    return Response.json(serializeStatement(statement));
  } catch (error) {
    return handleError(error);
  }
}
