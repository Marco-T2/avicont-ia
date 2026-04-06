import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { UsersService } from "@/features/shared/users.service";
import { PaymentService } from "@/features/payment";
import { updateAllocationsSchema } from "@/features/payment";

const paymentService = new PaymentService();
const usersService = new UsersService();

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; paymentId: string }> },
) {
  try {
    const { userId: clerkUserId } = await requireAuth();
    const { orgSlug, paymentId } = await params;
    const orgId = await requireOrgAccess(clerkUserId, orgSlug);
    const member = await requireRole(clerkUserId, orgId, ["owner", "admin", "contador"]);

    const body = await request.json();
    const { allocations, justification } = updateAllocationsSchema.parse(body);

    const user = await usersService.resolveByClerkId(clerkUserId);

    const result = await paymentService.updateAllocations(
      orgId,
      paymentId,
      allocations,
      user.id,
      member.role,
      justification,
    );

    return Response.json(result);
  } catch (error) {
    return handleError(error);
  }
}
