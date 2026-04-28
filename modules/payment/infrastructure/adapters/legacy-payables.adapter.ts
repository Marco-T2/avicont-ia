import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import type {
  PayablesPort,
  PayableStatusValue,
} from "../../domain/ports/payables.port";
import { makePayablesService } from "@/modules/payables/presentation/server";

/**
 * Adapter wrapping the payables module's application service. Symmetric mirror
 * of `LegacyReceivablesAdapter` — see that file for rationale.
 */
export class LegacyPayablesAdapter implements PayablesPort {
  private readonly service = makePayablesService();

  async getStatusByIdTx(
    tx: unknown,
    organizationId: string,
    id: string,
  ): Promise<PayableStatusValue | null> {
    const row = await (tx as Prisma.TransactionClient).accountsPayable.findFirst({
      where: { id, organizationId },
      select: { status: true },
    });
    return (row?.status as PayableStatusValue | undefined) ?? null;
  }

  async getBalanceByIdTx(
    tx: unknown,
    organizationId: string,
    id: string,
  ): Promise<number | null> {
    const row = await (tx as Prisma.TransactionClient).accountsPayable.findFirst({
      where: { id, organizationId },
      select: { balance: true },
    });
    return row ? Number(row.balance) : null;
  }

  async applyAllocation(
    tx: unknown,
    organizationId: string,
    id: string,
    amount: MonetaryAmount,
  ): Promise<void> {
    await this.service.applyAllocation(tx, organizationId, id, amount);
  }

  async revertAllocation(
    tx: unknown,
    organizationId: string,
    id: string,
    amount: MonetaryAmount,
  ): Promise<void> {
    await this.service.revertAllocation(tx, organizationId, id, amount);
  }
}
