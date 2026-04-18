import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { PaymentService } from "@/features/payment";
import { updatePaymentSchema } from "@/features/payment";

const paymentService = new PaymentService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; paymentId: string }> },
) {
  try {
    const { orgSlug, paymentId } = await params;
    const { orgId } = await requirePermission("payments", "read", orgSlug);

    const payment = await paymentService.getById(orgId, paymentId);

    return Response.json(payment);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; paymentId: string }> },
) {
  try {
    const { orgSlug, paymentId } = await params;
    const { session, orgId, role } = await requirePermission(
      "payments",
      "write",
      orgSlug,
    );
    const userId = session.userId;

    const body = await request.json();
    const { justification, ...rest } = body;
    const input = updatePaymentSchema.parse(rest);

    const payment = await paymentService.update(orgId, paymentId, input, role, justification, userId);

    return Response.json(payment);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; paymentId: string }> },
) {
  try {
    const { orgSlug, paymentId } = await params;
    const { orgId } = await requirePermission("payments", "write", orgSlug);

    await paymentService.delete(orgId, paymentId);

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
}
