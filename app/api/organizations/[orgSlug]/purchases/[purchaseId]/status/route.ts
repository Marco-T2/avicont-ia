import { z } from "zod";
import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { UsersService } from "@/features/shared/users.service";
import { PurchaseService } from "@/features/purchase/server";

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
    const { orgSlug, purchaseId } = await params;
    const { session, orgId } = await requirePermission(
      "purchases",
      "write",
      orgSlug,
    );
    const clerkUserId = session.userId;

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
