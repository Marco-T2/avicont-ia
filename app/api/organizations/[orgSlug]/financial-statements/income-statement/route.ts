import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { FinancialStatementsService } from "@/features/accounting/financial-statements";
import { serializeStatement } from "@/features/accounting/financial-statements";
import { incomeStatementQuerySchema } from "@/features/accounting/financial-statements/financial-statements.validation";
import type { Role } from "@/features/shared/permissions";

// Node.js runtime requerido por los exporters de PR4 (pdfmake + exceljs usan Buffer/streams nativos)
export const runtime = "nodejs";

const service = new FinancialStatementsService();

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
    // 1. Autenticación Clerk (REQ-13)
    const { userId } = await requireAuth();

    // 2. Resolver orgSlug → orgId y verificar membresía
    const { orgSlug } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);

    // 3. Verificar rol (solo owner, admin, contador — REQ-13)
    const member = await requireRole(userId, orgId, ["owner", "admin", "contador"]);
    const userRole = member.role as Role;

    // 4. Validar query params con Zod (incluye refine dateFrom <= dateTo)
    const { searchParams } = new URL(request.url);
    const query = incomeStatementQuerySchema.parse({
      periodId: searchParams.get("periodId") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      format: searchParams.get("format") ?? undefined,
    });

    // 5. Generar el Estado de Resultados
    const statement = await service.generateIncomeStatement(orgId, userRole, {
      fiscalPeriodId: query.periodId,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
    });

    // 6. Serializar Decimals → strings en la frontera (REQ-10, D9)
    return Response.json(serializeStatement(statement));
  } catch (error) {
    return handleError(error);
  }
}
