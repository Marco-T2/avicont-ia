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
      // Only POSTED/LOCKED payments moved cash and count as available credit.
      // A DRAFT has not been contabilizado, so it must NOT inflate the contact's
      // saldo a favor (draft-credit-leak).
      where: { organizationId, contactId, status: { in: ["POSTED", "LOCKED"] } },
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
