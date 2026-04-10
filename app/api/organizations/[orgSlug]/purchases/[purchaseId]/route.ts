import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { PurchaseService } from "@/features/purchase";
import { updatePurchaseSchema } from "@/features/purchase";

const purchaseService = new PurchaseService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; purchaseId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, purchaseId } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

    const purchase = await purchaseService.getById(orgId, purchaseId);

    return Response.json(purchase);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; purchaseId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, purchaseId } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    const member = await requireRole(userId, orgId, ["owner", "admin", "contador"]);

    const body = await request.json();
    const { justification, ...rest } = body;
    const input = updatePurchaseSchema.parse(rest);

    const purchase = await purchaseService.update(orgId, purchaseId, input, member.role, justification, userId);

    return Response.json(purchase);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; purchaseId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, purchaseId } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

    await purchaseService.delete(orgId, purchaseId);

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
}
