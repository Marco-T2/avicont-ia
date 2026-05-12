import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import {
  createSaleSchema,
  saleFiltersSchema,
} from "@/modules/sale/presentation/schemas/sale.schemas";
import { parsePaginationParams } from "@/modules/shared/presentation/parse-pagination-params";
import { UsersService } from "@/features/users/server";
import { makeSaleService } from "@/modules/sale/presentation/composition-root";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

const saleService = makeSaleService();
const usersService = new UsersService();

const M = (v: number | undefined): MonetaryAmount =>
  v === undefined ? MonetaryAmount.zero() : MonetaryAmount.of(v);

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
    const pagination = parsePaginationParams(searchParams);

    const result = await saleService.listPaginated(orgId, filters, pagination);

    return Response.json(result);
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
    const wrappedInput = {
      ...input,
      date: new Date(input.date),
      details: input.details.map((d) => ({ ...d, lineAmount: M(d.lineAmount) })),
    };
    const result = postImmediately
      ? await saleService.createAndPost(orgId, wrappedInput, {
          userId: user.id,
          role,
        })
      : await saleService.createDraft(orgId, wrappedInput, user.id);

    return Response.json(result, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
