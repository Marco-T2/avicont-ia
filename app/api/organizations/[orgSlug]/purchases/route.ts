import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { PurchaseService } from "@/features/purchase";
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
    const { userId } = await requireAuth();
    const { orgSlug } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

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
    const { userId } = await requireAuth();
    const { orgSlug } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

    const body = await request.json();
    const { postImmediately, ...rest } = body;
    const input = createPurchaseSchema.parse(rest);

    const user = await usersService.resolveByClerkId(userId);
    const purchase = postImmediately
      ? await purchaseService.createAndPost(orgId, input, user.id)
      : await purchaseService.createDraft(orgId, input, user.id);

    return Response.json(purchase, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
