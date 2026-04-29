import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import {
  createSaleSchema,
  saleFiltersSchema,
} from "@/features/sale";
import { UsersService } from "@/features/users/server";
import { makeSaleService } from "@/modules/sale/presentation/composition-root";

const saleService = makeSaleService();
const usersService = new UsersService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("sales", "read", orgSlug);

    const { searchParams } = new URL(request.url);
    const filters = saleFiltersSchema.parse({
      status: searchParams.get("status") ?? undefined,
      contactId: searchParams.get("contactId") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      periodId: searchParams.get("periodId") ?? undefined,
    });

    const sales = await saleService.list(orgId, filters);

    return Response.json(sales);
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
      "sales",
      "write",
      orgSlug,
    );
    const userId = session.userId;

    const body = await request.json();
    const { postImmediately, ...rest } = body;
    const input = createSaleSchema.parse(rest);

    const user = await usersService.resolveByClerkId(userId);
    const result = postImmediately
      ? await saleService.createAndPost(orgId, input, {
          userId: user.id,
          role,
        })
      : await saleService.createDraft(orgId, input, user.id);

    return Response.json(result, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
