import type { Prisma } from "@/generated/prisma/client";

import type { FiscalPeriodsTxRepo } from "../domain/ports/fiscal-periods-tx.repo";

/**
 * Prisma-backed adapter for `FiscalPeriodsTxRepo`. Bound at construction to
 * an open `Prisma.TransactionClient` — the consumer never sees the tx token.
 *
 * Mirrors `MonthlyCloseRepository.markPeriodClosed` byte-for-byte: same
 * `where` shape (`id` + `organizationId`), same enum literal, same return
 * value. The audit row is emitted by the `audit_fiscal_periods` PL/pgSQL
 * trigger, NOT by this adapter.
 */
export class PrismaFiscalPeriodsTxRepo implements FiscalPeriodsTxRepo {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async markClosed(
    organizationId: string,
    periodId: string,
    userId: string,
  ): Promise<{ closedAt: Date; closedBy: string }> {
    const closedAt = new Date();
    await this.tx.fiscalPeriod.update({
      where: { id: periodId, organizationId },
      data: { status: "CLOSED", closedAt, closedBy: userId },
    });
    return { closedAt, closedBy: userId };
  }
}
