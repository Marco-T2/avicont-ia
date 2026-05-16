import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { UsersService } from "@/features/users/server";
import { saleStatusSchema } from "@/modules/sale/presentation/schemas/sale.schemas";
import { makeSaleService } from "@/modules/sale/presentation/composition-root";

const usersService = new UsersService();
const saleService = makeSaleService();

export async function PATCH(
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

    let result;
    if (status === "POSTED") {
      result = await saleService.post(orgId, saleId, user.id);
    } else {
      result = await saleService.void(orgId, saleId, {
        userId: user.id,
        role,
        justification,
      });
    }

    return Response.json(result);
  } catch (error) {
    return handleError(error);
  }
}
