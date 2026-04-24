import { requireAuth, handleError } from "@/features/shared/middleware";
import { requireOrgAccess } from "@/features/organizations/server";
import { OrganizationsService } from "@/features/organizations/server";
import { AgentService } from "@/features/ai-agent/server";
import { ExpensesService } from "@/features/expenses/server";
import { MortalityService } from "@/features/mortality/server";
import { createExpenseSchema } from "@/features/expenses/expenses.validation";
import { logMortalitySchema } from "@/features/mortality/mortality.validation";
import { agentQuerySchema, confirmActionSchema } from "@/features/ai-agent/agent.validation";

const orgService = new OrganizationsService();
const agentService = new AgentService();
const expensesService = new ExpensesService();
const mortalityService = new MortalityService();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { userId: clerkUserId } = await requireAuth();
    const { orgSlug } = await params;
    const organizationId = await requireOrgAccess(clerkUserId, orgSlug);

    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    const member = await orgService.getMemberWithUserByClerkUserId(
      organizationId,
      clerkUserId,
    );

    // ── Confirm action ──
    if (action === "confirm") {
      return handleConfirm(request, organizationId, member.user.id);
    }

    // ── Query agent ──
    const body = await request.json();
    const { prompt, session_id } = agentQuerySchema.parse(body);

    const response = await agentService.query(
      organizationId,
      member.user.id,
      member.role,
      prompt,
      session_id,
    );

    return Response.json(response);
  } catch (error) {
    return handleError(error);
  }
}

// ── Confirm handler: execute the suggested action ──

async function handleConfirm(
  request: Request,
  organizationId: string,
  userId: string,
): Promise<Response> {
  const body = await request.json();
  const { suggestion } = confirmActionSchema.parse(body);

  switch (suggestion.action) {
    case "createExpense": {
      const d = suggestion.data;
      const validated = createExpenseSchema.parse({
        amount: d.amount,
        category: d.category,
        description: d.description,
        date: d.date,
        lotId: d.lotId,
      });
      const expense = await expensesService.create(organizationId, {
        ...validated,
        createdById: userId,
      });
      return Response.json(
        {
          message: "Gasto registrado exitosamente.",
          data: expense,
        },
        { status: 201 },
      );
    }

    case "logMortality": {
      const d = suggestion.data;
      const validated = logMortalitySchema.parse({
        count: d.count,
        cause: d.cause,
        date: d.date,
        lotId: d.lotId,
      });
      const log = await mortalityService.log(organizationId, {
        ...validated,
        createdById: userId,
      });
      return Response.json(
        {
          message: "Mortalidad registrada exitosamente.",
          data: log,
        },
        { status: 201 },
      );
    }

    default:
      return Response.json(
        { error: `Acción no confirmable: ${suggestion.action}` },
        { status: 400 },
      );
  }
}
