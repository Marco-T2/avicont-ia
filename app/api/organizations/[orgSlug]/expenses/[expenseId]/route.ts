import { requireAuth, handleError } from "@/features/shared/middleware";
import { requireOrgAccess } from "@/features/organizations/server";
import { ExpensesService } from "@/features/expenses/expenses.service";
import { expenseIdSchema } from "@/features/expenses/expenses.validation";
import { NotFoundError } from "@/features/shared/errors";

const service = new ExpensesService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; expenseId: string }> },
) {
  try {
    const { userId: clerkUserId } = await requireAuth();
    const { orgSlug, expenseId } = await params;
    const orgId = await requireOrgAccess(clerkUserId, orgSlug);

    expenseIdSchema.parse(expenseId);

    const expense = await service.getById(orgId, expenseId);
    if (!expense) throw new NotFoundError("Gasto");

    return Response.json(expense);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; expenseId: string }> },
) {
  try {
    const { userId: clerkUserId } = await requireAuth();
    const { orgSlug, expenseId } = await params;
    const orgId = await requireOrgAccess(clerkUserId, orgSlug);

    expenseIdSchema.parse(expenseId);

    await service.delete(orgId, expenseId);

    return Response.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
