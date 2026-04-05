import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { PaymentService } from "@/features/payment";
import {
  createPaymentSchema,
  paymentFiltersSchema,
} from "@/features/payment";
import { UsersService } from "@/features/shared/users.service";

const paymentService = new PaymentService();
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
    const filters = paymentFiltersSchema.parse({
      method: searchParams.get("method") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      contactId: searchParams.get("contactId") ?? undefined,
      receivableId: searchParams.get("receivableId") ?? undefined,
      payableId: searchParams.get("payableId") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      periodId: searchParams.get("periodId") ?? undefined,
    });

    const payments = await paymentService.list(orgId, filters);

    return Response.json(payments);
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
    const input = createPaymentSchema.parse(body);

    const user = await usersService.resolveByClerkId(userId);
    const payment = await paymentService.create(orgId, { ...input, createdById: user.id });

    return Response.json(payment, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
