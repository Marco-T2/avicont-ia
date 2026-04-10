import { z } from "zod";
import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { PaymentService } from "@/features/payment";

const paymentService = new PaymentService();

const applyCreditSchema = z.object({
  contactId: z.string().min(1),
  creditSources: z.array(
    z.object({
      sourcePaymentId: z.string().min(1),
      receivableId: z.string().min(1),
      amount: z.number().positive(),
    }),
  ).min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

    const body = await request.json();
    const { contactId, creditSources } = applyCreditSchema.parse(body);

    await paymentService.applyCreditOnly(orgId, contactId, creditSources);

    return Response.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
