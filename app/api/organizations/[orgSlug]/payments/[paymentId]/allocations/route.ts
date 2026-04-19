import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { UsersService } from "@/features/shared/users.service";
import { PaymentService } from "@/features/payment/server";
import { updateAllocationsSchema } from "@/features/payment";

const paymentService = new PaymentService();
const usersService = new UsersService();

export async function PUT(
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
    const { allocations, justification } = updateAllocationsSchema.parse(body);

    const user = await usersService.resolveByClerkId(clerkUserId);

    const result = await paymentService.updateAllocations(
      orgId,
      paymentId,
      allocations,
      user.id,
      role,
      justification,
    );

    return Response.json(result);
  } catch (error) {
    return handleError(error);
  }
}
