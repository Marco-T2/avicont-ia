import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { PurchaseService } from "@/features/purchase/server";
import {
  createPurchaseSchema,
  purchaseFiltersSchema,
} from "@/features/purchase";
import { UsersService } from "@/features/shared/users.service";

const purchaseService = new PurchaseService();
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
    const purchase = postImmediately
      ? await purchaseService.createAndPost(orgId, input, {
          userId: user.id,
          role,
        })
      : await purchaseService.createDraft(orgId, input, user.id);

    return Response.json(purchase, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
