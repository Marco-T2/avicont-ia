import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { makeOrganizationsService } from "@/modules/organizations/presentation/server";
import { FinancialStatementsService } from "@/features/accounting/financial-statements/server";
import { balanceSheetQuerySchema } from "@/features/accounting/financial-statements/server";
import { makeAgentService, makeAgentRateLimitService } from "@/modules/ai-agent/presentation/server";
import { logStructured } from "@/lib/logging/structured";
import type { Role } from "@/features/permissions";

export const runtime = "nodejs";

const orgService = makeOrganizationsService();
const fsService = new FinancialStatementsService();
const agentService = makeAgentService();
const rateLimitService = makeAgentRateLimitService();

/**
 * POST /api/organizations/[orgSlug]/financial-statements/balance-sheet/analyze
 *
 * Genera un análisis IA del Balance General. One-shot: construye el balance
 * con los mismos params que el GET, lo curra y lo pasa al LLM. La respuesta
 * NO se persiste — efímera por click.
 *
 * Body: mismos campos que los query params del GET balance-sheet, sin `format`.
 *
 * Respuestas:
 * - 200: { status: "ok"|"trivial"|"error", ... }
 * - 400: body inválido (Zod)
 * - 401/403: auth/permission
 * - 429: rate limit excedido (compartido con agente conversacional)
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
    const query = balanceSheetQuerySchema.parse({
      date: body.date,
      periodId: body.periodId,
      preset: body.preset,
      breakdownBy: body.breakdownBy,
      compareWith: body.compareWith,
      compareAsOfDate: body.compareAsOfDate,
    });

    // Rate-limit gate: bucket compartido con el agente conversacional. Falla
    // abierto en errores de DB (logueado dentro del service).
    const decision = await rateLimitService.check(orgId, member.user.id);
    if (!decision.allowed) {
      logStructured({
        event: "agent_rate_limited",
        level: "info",
        mode: "balance-sheet-analysis",
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

    const balance = await fsService.generateBalanceSheet(orgId, userRole, {
      asOfDate: new Date(query.date),
      fiscalPeriodId: query.periodId,
      preset: query.preset,
      breakdownBy: query.breakdownBy,
      compareWith: query.compareWith,
      compareAsOfDate: query.compareAsOfDate
        ? new Date(query.compareAsOfDate)
        : undefined,
    });

    const analysis = await agentService.analyzeBalanceSheet(
      orgId,
      member.user.id,
      member.role,
      balance,
    );

    return Response.json(analysis);
  } catch (error) {
    return handleError(error);
  }
}
