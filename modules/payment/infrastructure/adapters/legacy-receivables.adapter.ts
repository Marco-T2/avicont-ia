import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import type {
  ReceivablesPort,
  ReceivableStatusValue,
} from "../../domain/ports/receivables.port";
import { makeReceivablesService } from "@/modules/receivables/presentation/server";

/**
 * Adapter wrapping the receivables module's application service. The service
 * exposes `applyAllocation` / `revertAllocation` (Fase B) tx-aware use cases —
 * we just translate the call. Status reads use a bare Prisma query in lieu of
 * a dedicated `findStatusByIdTx` on the receivables repo (kept narrow to
 * avoid scope creep into receivables in this POC).
 */
export class LegacyReceivablesAdapter implements ReceivablesPort {
  private readonly service = makeReceivablesService();

  async getStatusByIdTx(
    tx: unknown,
    organizationId: string,
    id: string,
  ): Promise<ReceivableStatusValue | null> {
    const row = await (tx as Prisma.TransactionClient).accountsReceivable.findFirst(
      {
        where: { id, organizationId },
        select: { status: true },
      },
    );
    return (row?.status as ReceivableStatusValue | undefined) ?? null;
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
