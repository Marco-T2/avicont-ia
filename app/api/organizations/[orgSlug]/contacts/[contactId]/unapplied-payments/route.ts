import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { PaymentRepository } from "@/modules/payment/presentation/server";

const paymentRepository = new PaymentRepository();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; contactId: string }> },
) {
  try {
    const { orgSlug, contactId } = await params;
    const { orgId } = await requirePermission("payments", "read", orgSlug);

    const { searchParams } = new URL(request.url);
    const excludePaymentId = searchParams.get("excludePaymentId") ?? undefined;

    const payments = await paymentRepository.findUnappliedByContact(
      orgId,
      contactId,
      excludePaymentId,
    );

    return Response.json({ payments });
  } catch (error) {
    return handleError(error);
  }
}
