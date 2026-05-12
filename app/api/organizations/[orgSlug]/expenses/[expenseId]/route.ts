import { requireAuth, handleError } from "@/features/shared/middleware";
import { requireOrgAccess } from "@/modules/organizations/presentation/server";
import {
  makeExpenseService,
  expenseIdSchema,
} from "@/modules/expense/presentation/server";

const service = makeExpenseService();

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

    return Response.json(expense.toSnapshot());
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
