import {
  requireAuth,
  requireOrgAccess,
  handleError,
} from "@/features/shared/middleware";
import { OrganizationsService } from "@/features/organizations";
import { AgentService } from "@/features/ai-agent";
import { ExpensesService } from "@/features/expenses";
import { MortalityService } from "@/features/mortality";
import type { ConfirmActionRequest } from "@/features/ai-agent";
import type { ExpenseCategory } from "@/generated/prisma/client";

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
    const prompt = body.prompt;

    if (!prompt || typeof prompt !== "string") {
      return Response.json(
        { error: "Se requiere un prompt" },
        { status: 400 },
      );
    }

    const response = await agentService.query(
      organizationId,
      member.user.id,
      member.role,
      prompt,
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
  const body: ConfirmActionRequest = await request.json();
  const { suggestion } = body;

  if (!suggestion || !suggestion.action) {
    return Response.json(
      { error: "Se requiere una sugerencia para confirmar" },
      { status: 400 },
    );
  }

  switch (suggestion.action) {
    case "createExpense": {
      const d = suggestion.data;
      const expense = await expensesService.create(organizationId, {
        amount: d.amount,
        category: d.category as ExpenseCategory,
        description: d.description,
        date: new Date(d.date),
        lotId: d.lotId,
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
      const log = await mortalityService.log(organizationId, {
        count: d.count,
        cause: d.cause,
        date: new Date(d.date),
        lotId: d.lotId,
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
