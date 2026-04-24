import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { UsersService } from "@/features/users/server";
import { SaleService } from "@/features/sale/server";
import { saleStatusSchema } from "@/features/sale";

const usersService = new UsersService();
const saleService = new SaleService();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; saleId: string }> },
) {
  try {
    const { orgSlug, saleId } = await params;
    const { session, orgId, role } = await requirePermission(
      "sales",
      "write",
      orgSlug,
    );
    const clerkUserId = session.userId;

    const body = await request.json();
    const { status, justification } = saleStatusSchema.parse(body);

    const user = await usersService.resolveByClerkId(clerkUserId);

    let sale;
    if (status === "POSTED") {
      sale = await saleService.post(orgId, saleId, user.id);
    } else {
      sale = await saleService.void(orgId, saleId, user.id, role, justification);
    }

    return Response.json(sale);
  } catch (error) {
    return handleError(error);
  }
}
