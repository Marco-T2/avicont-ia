import { z } from "zod";
import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { PaymentService } from "@/modules/payment/presentation/server";

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
    const { orgSlug } = await params;
    const { orgId, session } = await requirePermission("payments", "write", orgSlug);

    const body = await request.json();
    const { contactId, creditSources } = applyCreditSchema.parse(body);

    await paymentService.applyCreditOnly(orgId, session.userId, contactId, creditSources);

    return Response.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
