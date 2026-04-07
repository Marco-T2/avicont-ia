import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { PaymentRepository } from "@/features/payment";

const paymentRepository = new PaymentRepository();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; contactId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, contactId } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

    const { searchParams } = new URL(request.url);
    const excludePaymentId = searchParams.get("excludePaymentId") ?? undefined;

    const payments = await paymentRepository.findUnappliedPayments(
      orgId,
      contactId,
      excludePaymentId,
    );

    return Response.json({ payments });
  } catch (error) {
    return handleError(error);
  }
}
