import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import type {
  CreditConsumptionPort,
  CreditConsumptionLink,
  WriteCreditConsumptionInput,
} from "../../domain/ports/credit-consumption.port";

/**
 * Prisma direct adapter for `CreditConsumptionPort`. This is the ONLY layer
 * that touches the Prisma `Decimal` value-form for credit links — the port
 * exchanges `MonetaryAmount` (DEC-1). `amount` is written as a fixed-2 string
 * (Prisma accepts string for `Decimal`) and read back via `.toString()` →
 * `MonetaryAmount.of`, mirroring the money round-trip used across the payment
 * infrastructure adapters.
 */
export class PrismaCreditConsumptionAdapter implements CreditConsumptionPort {
  async writeTx(
    tx: unknown,
    input: WriteCreditConsumptionInput,
  ): Promise<void> {
    const txc = tx as Prisma.TransactionClient;
    await txc.creditConsumption.create({
      data: {
        organizationId: input.organizationId,
        consumerPaymentId: input.consumerPaymentId,
        sourcePaymentId: input.sourcePaymentId,
        // XOR target: receivableId for COBRO, payableId for PAGO. The port
        // already passes exactly one non-null (AllocationTarget VO, Zod).
        receivableId: input.receivableId,
        payableId: input.payableId,
        amount: input.amount.value.toFixed(2),
      },
    });
  }

  async findByConsumerPaymentIdTx(
    tx: unknown,
    organizationId: string,
    consumerPaymentId: string,
  ): Promise<CreditConsumptionLink[]> {
    const txc = tx as Prisma.TransactionClient;
    const rows = await txc.creditConsumption.findMany({
      where: { organizationId, consumerPaymentId },
      select: {
        sourcePaymentId: true,
        receivableId: true,
        payableId: true,
        amount: true,
        consumerPaymentId: true,
      },
    });
    return rows.map((r) => ({
      sourcePaymentId: r.sourcePaymentId,
      // XOR target round-trip: a COBRO link reads receivableId (payableId null),
      // a PAGO link reads payableId (receivableId null). revertCreditTx dispatches
      // by whichever is present.
      receivableId: r.receivableId,
      payableId: r.payableId,
      amount: MonetaryAmount.of(r.amount.toString()),
      consumerPaymentId: r.consumerPaymentId,
    }));
  }

  async deleteByConsumerPaymentIdTx(
    tx: unknown,
    organizationId: string,
    consumerPaymentId: string,
  ): Promise<void> {
    const txc = tx as Prisma.TransactionClient;
    await txc.creditConsumption.deleteMany({
      where: { organizationId, consumerPaymentId },
    });
  }
}
