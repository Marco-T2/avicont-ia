import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { UsersService } from "@/features/shared/users.service";
import { SaleService, saleStatusSchema } from "@/features/sale";

const usersService = new UsersService();
const saleService = new SaleService();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; saleId: string }> },
) {
  try {
    const { userId: clerkUserId } = await requireAuth();
    const { orgSlug, saleId } = await params;
    const orgId = await requireOrgAccess(clerkUserId, orgSlug);
    const member = await requireRole(clerkUserId, orgId, ["owner", "admin", "contador"]);

    const body = await request.json();
    const { status, justification } = saleStatusSchema.parse(body);

    const user = await usersService.resolveByClerkId(clerkUserId);

    let sale;
    if (status === "POSTED") {
      sale = await saleService.post(orgId, saleId, user.id);
    } else {
      sale = await saleService.void(orgId, saleId, user.id, member.role, justification);
    }

    return Response.json(sale);
  } catch (error) {
    return handleError(error);
  }
}
