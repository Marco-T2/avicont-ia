import { z } from "zod";
import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { UsersService } from "@/features/shared/users.service";
import { PurchaseService } from "@/features/purchase";

const usersService = new UsersService();
const purchaseService = new PurchaseService();

const purchaseActionSchema = z.object({
  status: z.enum(["POSTED", "VOIDED"]),
  justification: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; purchaseId: string }> },
) {
  try {
    const { userId: clerkUserId } = await requireAuth();
    const { orgSlug, purchaseId } = await params;
    const orgId = await requireOrgAccess(clerkUserId, orgSlug);
    await requireRole(clerkUserId, orgId, ["owner", "admin", "contador"]);

    const body = await request.json();
    const { status, justification } = purchaseActionSchema.parse(body);

    const user = await usersService.resolveByClerkId(clerkUserId);

    let purchase;
    if (status === "POSTED") {
      purchase = await purchaseService.post(orgId, purchaseId, user.id);
    } else {
      purchase = await purchaseService.void(orgId, purchaseId, user.id, justification);
    }

    return Response.json(purchase);
  } catch (error) {
    return handleError(error);
  }
}
