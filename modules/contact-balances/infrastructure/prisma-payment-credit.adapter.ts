import "server-only";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma/client";
import type { PaymentCreditPort } from "../domain/ports/payment-credit.port";
import type { PaymentForCreditCalc } from "../domain/ports/types";

type DbClient = Pick<PrismaClient, "payment">;

export class PrismaPaymentCreditAdapter implements PaymentCreditPort {
  constructor(private readonly db: DbClient = prisma) {}

  async findActivePaymentsForContact(
    organizationId: string,
    contactId: string,
  ): Promise<PaymentForCreditCalc[]> {
    const rows = await this.db.payment.findMany({
      where: { organizationId, contactId, status: { not: "VOIDED" } },
      include: {
        allocations: {
          include: { receivable: true, payable: true },
        },
      },
    });

    return rows.map((p) => ({
      amount: Number(p.amount),
      allocations: p.allocations.map((a) => ({
        amount: Number(a.amount),
        targetVoided:
          a.receivable?.status === "VOIDED" || a.payable?.status === "VOIDED",
      })),
    }));
  }
}
