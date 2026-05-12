import "server-only";
import { BaseRepository } from "@/modules/shared/infrastructure/base.repository";
import { Prisma } from "@/generated/prisma/client";
import type { AccountNature } from "@/generated/prisma/client";
import type { AccountBalanceWithRelations } from "@/modules/account-balances/infrastructure/account-balances.types";

const balanceInclude = {
  account: {
    select: { id: true, code: true, name: true, type: true, nature: true },
  },
  period: {
    select: { id: true, name: true, year: true },
  },
} as const;

export class AccountBalancesRepository extends BaseRepository {
  async findByPeriod(
    organizationId: string,
    periodId: string,
    accountId?: string,
  ): Promise<AccountBalanceWithRelations[]> {
    const scope = this.requireOrg(organizationId);

    return this.db.accountBalance.findMany({
      where: {
        ...scope,
        periodId,
        ...(accountId ? { accountId } : {}),
      },
      include: balanceInclude,
      orderBy: { account: { code: "asc" } },
    }) as Promise<AccountBalanceWithRelations[]>;
  }

  async upsert(
    tx: Prisma.TransactionClient,
    accountId: string,
    periodId: string,
    orgId: string,
    debitDelta: number | string,
    creditDelta: number | string,
    nature: AccountNature,
  ): Promise<void> {
    // Paso 1: upsert para incrementar los totales de forma atómica
    const record = await tx.accountBalance.upsert({
      where: {
        accountId_periodId: { accountId, periodId },
      },
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

    // Paso 2: releer para obtener los totales post-incremento (Prisma devuelve los valores previos al actualizar con increment)
    const fresh = await tx.accountBalance.findUniqueOrThrow({
      where: { id: record.id },
    });

    // Paso 3: recalcular el saldo en base a los totales actualizados y la naturaleza de la cuenta
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
