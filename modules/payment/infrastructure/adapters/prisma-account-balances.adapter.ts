import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { AccountNature } from "@/generated/prisma/client";
import type { AccountBalancesPort } from "../../domain/ports/account-balances.port";
import type { JournalEntrySnapshot } from "../../domain/ports/accounting.port";

/**
 * Prisma direct adapter for `AccountBalancesPort`. Inline 3-step UPSERT
 * (paridad `PrismaAccountBalancesRepo` accounting C5 P2; replaces legacy).
 */
export class PrismaAccountBalancesAdapter implements AccountBalancesPort {
  async applyPostTx(
    tx: unknown,
    entry: JournalEntrySnapshot,
  ): Promise<void> {
    const txc = tx as Prisma.TransactionClient;
    for (const line of entry.lines) {
      await this.upsertBalance(
        txc,
        line.accountId,
        entry.periodId,
        entry.organizationId,
        line.debit.toString(),
        line.credit.toString(),
        line.accountNature as unknown as AccountNature,
      );
    }
  }

  async applyVoidTx(
    tx: unknown,
    entry: JournalEntrySnapshot,
  ): Promise<void> {
    const txc = tx as Prisma.TransactionClient;
    for (const line of entry.lines) {
      await this.upsertBalance(
        txc,
        line.accountId,
        entry.periodId,
        entry.organizationId,
        (-line.debit).toString(),
        (-line.credit).toString(),
        line.accountNature as unknown as AccountNature,
      );
    }
  }

  private async upsertBalance(
    tx: Prisma.TransactionClient,
    accountId: string,
    periodId: string,
    orgId: string,
    debitDelta: string,
    creditDelta: string,
    nature: AccountNature,
  ): Promise<void> {
    // Paso 1: upsert para incrementar totales atómicamente. Paridad legacy
    // `account-balances.repository.ts:43-61` — Prisma devuelve los valores
    // PREVIOS al increment, por eso paso 2 + 3 son obligatorios.
    const record = await tx.accountBalance.upsert({
      where: { accountId_periodId: { accountId, periodId } },
      create: {
        accountId,
        periodId,
        organizationId: orgId,
        debitTotal: debitDelta,
        creditTotal: creditDelta,
        balance: new Prisma.Decimal(0),
      },
      update: {
        debitTotal: { increment: debitDelta },
        creditTotal: { increment: creditDelta },
      },
    });

    // Paso 2: releer para obtener totales post-incremento.
    const fresh = await tx.accountBalance.findUniqueOrThrow({
      where: { id: record.id },
    });

    // Paso 3: recalcular balance por nature y persistir.
    const balance =
      nature === "DEUDORA"
        ? fresh.debitTotal.minus(fresh.creditTotal)
        : fresh.creditTotal.minus(fresh.debitTotal);

    await tx.accountBalance.update({
      where: { id: record.id },
      data: { balance },
    });
  }
}
