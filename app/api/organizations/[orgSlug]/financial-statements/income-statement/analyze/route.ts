import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { makeOrganizationsService } from "@/modules/organizations/presentation/server";
import { FinancialStatementsService } from "@/features/accounting/financial-statements/server";
import { incomeStatementQuerySchema } from "@/features/accounting/financial-statements/server";
import { AgentService, AgentRateLimitService } from "@/features/ai-agent/server";
import { logStructured } from "@/lib/logging/structured";
import type { Role } from "@/features/permissions";

export const runtime = "nodejs";

const orgService = makeOrganizationsService();
const fsService = new FinancialStatementsService();
const agentService = new AgentService();
const rateLimitService = new AgentRateLimitService();

/**
 * POST /api/organizations/[orgSlug]/financial-statements/income-statement/analyze
 *
 * Genera un análisis IA del Estado de Resultados con su Balance General
 * cruzado al cierre del período. One-shot: construye IS con los mismos
 * params que el GET, genera BG con `asOfDate = is.current.dateTo`, los
 * pasa al LLM. La respuesta NO se persiste — efímera por click.
 *
 * Body: mismos campos que los query params del GET income-statement, sin `format`.
 *
 * Respuestas:
 * - 200: { status: "ok"|"trivial"|"error", ... }
 * - 400: body inválido (Zod)
 * - 401/403: auth/permission
 * - 429: rate limit excedido (compartido con agente conversacional y BG analyze)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { session, orgId, role } = await requirePermission(
      "reports",
      "read",
      orgSlug,
    );
    const userRole = role as Role;

    const member = await orgService.getMemberWithUserByClerkUserId(
      orgId,
      session.userId,
    );

    const body = await request.json().catch(() => ({}));
    const query = incomeStatementQuerySchema.parse({
      periodId: body.periodId,
      dateFrom: body.dateFrom,
      dateTo: body.dateTo,
      preset: body.preset,
      breakdownBy: body.breakdownBy,
      compareWith: body.compareWith,
      compareDateFrom: body.compareDateFrom,
      compareDateTo: body.compareDateTo,
    });

    // Rate-limit gate: bucket compartido con el agente conversacional y el
    // análisis del Balance General. Falla abierto en errores de DB.
    const decision = await rateLimitService.check(orgId, member.user.id);
    if (!decision.allowed) {
      logStructured({
        event: "agent_rate_limited",
        level: "info",
        mode: "income-statement-analysis",
        orgId,
        userId: member.user.id,
        scope: decision.scope,
        limit: decision.limit,
        retryAfterSeconds: decision.retryAfterSeconds,
      });
      return Response.json(
        {
          error: "rate_limit_exceeded",
          scope: decision.scope,
          limit: decision.limit,
          retryAfterSeconds: decision.retryAfterSeconds,
          message:
            decision.scope === "user"
              ? `Excediste el límite de ${decision.limit} consultas por hora. Intentá de nuevo en ${decision.retryAfterSeconds} segundos.`
              : `Tu organización excedió el límite de ${decision.limit} consultas por hora. Intentá de nuevo en ${decision.retryAfterSeconds} segundos.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(decision.retryAfterSeconds) },
        },
      );
    }

    const incomeStatement = await fsService.generateIncomeStatement(orgId, userRole, {
      fiscalPeriodId: query.periodId,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      preset: query.preset,
      breakdownBy: query.breakdownBy,
      compareWith: query.compareWith,
      compareDateFrom: query.compareDateFrom ? new Date(query.compareDateFrom) : undefined,
      compareDateTo: query.compareDateTo ? new Date(query.compareDateTo) : undefined,
    });

    // BG cruzado a la fecha exacta de cierre del IS (no se redondea a fin
    // de período fiscal contenedor — verificado en el service).
    const balanceSheet = await fsService.generateBalanceSheet(orgId, userRole, {
      asOfDate: incomeStatement.current.dateTo,
    });

    const analysis = await agentService.analyzeIncomeStatement(
      orgId,
      member.user.id,
      member.role,
      incomeStatement.current,
      balanceSheet.current,
    );

    return Response.json(analysis);
  } catch (error) {
    return handleError(error);
  }
}
