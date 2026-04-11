import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { SaleService } from "@/features/sale";
import { updateSaleSchema } from "@/features/sale";
import { UsersService } from "@/features/shared/users.service";

const saleService = new SaleService();
const usersService = new UsersService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; saleId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, saleId } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

    const sale = await saleService.getById(orgId, saleId);

    return Response.json(sale);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; saleId: string }> },
) {
  try {
    const { userId: clerkUserId } = await requireAuth();
    const { orgSlug, saleId } = await params;
    const orgId = await requireOrgAccess(clerkUserId, orgSlug);
    const member = await requireRole(clerkUserId, orgId, ["owner", "admin", "contador"]);

    const body = await request.json();
    const { justification, ...rest } = body;
    const input = updateSaleSchema.parse(rest);

    const user = await usersService.resolveByClerkId(clerkUserId);
    const sale = await saleService.update(orgId, saleId, input, user.id, member.role, justification);

    return Response.json(sale);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; saleId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, saleId } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

    await saleService.delete(orgId, saleId);

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
}
