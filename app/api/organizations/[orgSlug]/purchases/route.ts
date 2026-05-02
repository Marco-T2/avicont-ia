import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import {
  createPurchaseSchema,
  purchaseFiltersSchema,
} from "@/modules/purchase/presentation/schemas/purchase.schemas";
import { UsersService } from "@/features/users/server";
import { makePurchaseService } from "@/modules/purchase/presentation/composition-root";

const purchaseService = makePurchaseService();
const usersService = new UsersService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("purchases", "read", orgSlug);

    const { searchParams } = new URL(request.url);
    const filters = purchaseFiltersSchema.parse({
      purchaseType: searchParams.get("purchaseType") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      contactId: searchParams.get("contactId") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      periodId: searchParams.get("periodId") ?? undefined,
    });

    const purchases = await purchaseService.list(orgId, filters);

    return Response.json(purchases);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { session, orgId, role } = await requirePermission(
      "purchases",
      "write",
      orgSlug,
    );
    const userId = session.userId;

    const body = await request.json();
    const { postImmediately, ...rest } = body;
    const input = createPurchaseSchema.parse(rest);

    const user = await usersService.resolveByClerkId(userId);
    const result = postImmediately
      ? await purchaseService.createAndPost(orgId, input, {
          userId: user.id,
          role,
        })
      : await purchaseService.createDraft(orgId, input, user.id);

    return Response.json(result, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
