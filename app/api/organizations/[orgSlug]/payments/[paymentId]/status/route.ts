import { z } from "zod";
import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { UsersService } from "@/features/shared/users.service";
import { PaymentService } from "@/features/payment";

const usersService = new UsersService();
const paymentService = new PaymentService();

const paymentActionSchema = z.object({
  status: z.enum(["POSTED", "VOIDED"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; paymentId: string }> },
) {
  try {
    const { userId: clerkUserId } = await requireAuth();
    const { orgSlug, paymentId } = await params;
    const orgId = await requireOrgAccess(clerkUserId, orgSlug);
    await requireRole(clerkUserId, orgId, ["owner", "admin", "contador"]);

    const body = await request.json();
    const { status } = paymentActionSchema.parse(body);

    const user = await usersService.resolveByClerkId(clerkUserId);

    let payment;
    if (status === "POSTED") {
      payment = await paymentService.post(orgId, paymentId, user.id);
    } else {
      payment = await paymentService.void(orgId, paymentId, user.id);
    }

    return Response.json(payment);
  } catch (error) {
    return handleError(error);
  }
}
