import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { PaymentService } from "@/features/payment";
import { updatePaymentSchema } from "@/features/payment";

const paymentService = new PaymentService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; paymentId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, paymentId } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

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
    const { userId } = await requireAuth();
    const { orgSlug, paymentId } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    const member = await requireRole(userId, orgId, ["owner", "admin", "contador"]);

    const body = await request.json();
    const { justification, ...rest } = body;
    const input = updatePaymentSchema.parse(rest);

    const payment = await paymentService.update(orgId, paymentId, input, member.role, justification);

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
    const { userId } = await requireAuth();
    const { orgSlug, paymentId } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

    await paymentService.delete(orgId, paymentId);

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
}
