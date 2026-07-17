// RBAC-EXCEPTION: Auth-only via requireOrgAccess; farms/lots/expenses/mortality
// NOT in frozen Resource union. Consistent with existing DELETE on this route.
import { requireAuth, handleError } from "@/modules/shared/presentation/middleware";
import { requireOrgAccess } from "@/modules/organizations/presentation/server";
import {
  makeExpenseService,
  expenseIdSchema,
  updateExpenseSchema,
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

/**
 * Updates editable fields (amount/category/date/description) of an
 * Expense. Spec REQ-103/REQ-104. lotId/organizationId/createdById
 * immutable (INV-03). updatedAt advances on every call.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; expenseId: string }> },
) {
  try {
    const { userId: clerkUserId } = await requireAuth();
    const { orgSlug, expenseId } = await params;
    const orgId = await requireOrgAccess(clerkUserId, orgSlug);

    expenseIdSchema.parse(expenseId);

    const body = await request.json();
    const input = updateExpenseSchema.parse(body);

    const updated = await service.update(orgId, expenseId, input);

    return Response.json(updated.toSnapshot());
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
