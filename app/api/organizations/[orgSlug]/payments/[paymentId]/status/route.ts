import { z } from "zod";
import { handleError } from "@/modules/shared/presentation/middleware";
import { requirePermission } from "@/modules/permissions/application/server";
import { makeUsersService } from "@/modules/users/presentation/composition-root";
import { PaymentService } from "@/modules/payment/presentation/server";

const usersService = makeUsersService();
const paymentService = new PaymentService();

const paymentActionSchema = z.object({
  status: z.enum(["POSTED", "VOIDED"]),
  justification: z.string().optional(),
});

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
    const clerkUserId = session.userId;

    const body = await request.json();
    const { status, justification } = paymentActionSchema.parse(body);

    const user = await usersService.resolveByClerkId(clerkUserId);

    let payment;
    if (status === "POSTED") {
      payment = await paymentService.post(orgId, paymentId, user.id);
    } else {
      payment = await paymentService.void(orgId, paymentId, user.id, role, justification);
    }

    return Response.json(payment);
  } catch (error) {
    return handleError(error);
  }
}
