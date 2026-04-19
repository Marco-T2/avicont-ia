import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { PaymentService } from "@/features/payment/server";
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
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("payments", "read", orgSlug);

    const { searchParams } = new URL(request.url);
    const filters = paymentFiltersSchema.parse({
      method: searchParams.get("method") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      contactId: searchParams.get("contactId") ?? undefined,
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
    const { orgSlug } = await params;
    const { session, orgId } = await requirePermission(
      "payments",
      "write",
      orgSlug,
    );
    const userId = session.userId;

    const body = await request.json();
    const { postImmediately, ...rest } = body;
    const input = createPaymentSchema.parse(rest);

    const user = await usersService.resolveByClerkId(userId);
    const payment = postImmediately
      ? await paymentService.createAndPost(orgId, { ...input, createdById: user.id }, user.id)
      : await paymentService.create(orgId, { ...input, createdById: user.id });

    return Response.json(payment, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
