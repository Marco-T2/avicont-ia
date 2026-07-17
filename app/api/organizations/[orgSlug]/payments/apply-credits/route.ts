import { z } from "zod";
import { handleError } from "@/modules/shared/presentation/middleware";
import { requirePermission } from "@/modules/permissions/application/server";
import { PaymentService } from "@/modules/payment/presentation/server";
import { PAYMENT_CREDIT_INVALID_TARGET } from "@/modules/shared/domain/errors";

const paymentService = new PaymentService();

// pago-credit-system Phase 5 — a credit source targets EITHER a receivable
// (COBRO) OR a payable (PAGO), never both, never neither (XOR). Enforced here
// at the Zod `.refine` edge — mirror of `allocationInputSchema`
// (modules/payment/presentation/validation.ts:14) — NOT by a service guard
// (`creditTargetOf` is valid-by-construction dispatch) nor a DB CHECK
// (CreditConsumption XOR is VO/Zod-enforced, discovery #3060). A failed refine
// surfaces as a ZodError → handleError maps it to HTTP 400.
const creditAllocationSourceSchema = z
  .object({
    sourcePaymentId: z.string().min(1),
    receivableId: z.string().min(1).optional(),
    payableId: z.string().min(1).optional(),
    amount: z.number().positive(),
  })
  .refine(
    (cs) =>
      (!!cs.receivableId && !cs.payableId) || (!cs.receivableId && !!cs.payableId),
    {
      message: "Cada origen de crédito debe vincular a una CxC o CxP, no ambas",
      params: { code: PAYMENT_CREDIT_INVALID_TARGET },
    },
  );

const applyCreditSchema = z.object({
  contactId: z.string().min(1),
  creditSources: z.array(creditAllocationSourceSchema).min(1),
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
