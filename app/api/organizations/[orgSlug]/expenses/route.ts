import {
  requireAuth,
  requireOrgAccess,
  handleError,
} from "@/features/shared/middleware";
import { UsersRepository } from "@/features/shared/users.repository";
import { ExpensesService } from "@/features/expenses/expenses.service";
import {
  createExpenseSchema,
  expenseFiltersSchema,
} from "@/features/expenses/expenses.validation";

const usersRepo = new UsersRepository();
const service = new ExpensesService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { userId: clerkUserId } = await requireAuth();
    const { orgSlug } = await params;
    const orgId = await requireOrgAccess(clerkUserId, orgSlug);

    const { searchParams } = new URL(request.url);
    const filters = expenseFiltersSchema.parse({
      lotId: searchParams.get("lotId") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
    });

    const expenses = filters.lotId
      ? await service.listByLot(orgId, filters.lotId)
      : await service.list(orgId, filters);

    return Response.json(expenses);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { userId: clerkUserId } = await requireAuth();
    const { orgSlug } = await params;
    const orgId = await requireOrgAccess(clerkUserId, orgSlug);

    const body = await request.json();
    const input = createExpenseSchema.parse(body);

    const user = await usersRepo.findByClerkUserId(clerkUserId);

    const expense = await service.create(orgId, {
      ...input,
      createdById: user.id,
    });

    return Response.json(expense, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
