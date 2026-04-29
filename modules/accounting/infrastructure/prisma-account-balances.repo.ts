import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { AccountNature } from "@/generated/prisma/client";
import type { Money } from "@/modules/shared/domain/value-objects/money";
import type { Journal } from "../domain/journal.entity";
import type { AccountBalancesRepository } from "../domain/ports/account-balances.repo";

/**
 * Prisma adapter for `AccountBalancesRepository`. Tx-bound — receives
 * `Prisma.TransactionClient` at construction time so the use case never sees
 * the tx token (architecture.md §4.3, mirrors `PrismaUnitOfWork` POC #9).
 *
 * Owns delta computation + sign rules + UPSERT semantics directly over
 * `account_balances` (POC #10 C5 P2 inline; cierra shim §5.5). El aggregate
 * NO carga `nature` por diseño — adapter lo lee de `accounts` por entrada
 * para recomputar `balance` (DEUDORA = debit - credit; ACREEDORA = credit -
 * debit).
 */

// `Money` is non-negative by construction (`money.ts:19-23, 43-48`); the
// `applyVoid` flow needs signed deltas, so we drop down to `Prisma.Decimal`
// inside infra. Localized here — domain stays insulated from negative VOs.
function positiveString(m: Money | null): string {
  return m?.toString() ?? "0";
}

function negatedString(m: Money | null): string {
  if (!m || m.isZero()) return "0";
  return new Prisma.Decimal(m.toString()).negated().toString();
}

export class PrismaAccountBalancesRepo implements AccountBalancesRepository {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async applyPost(entry: Journal): Promise<void> {
    const accounts = await this.tx.account.findMany({
      where: { id: { in: entry.lines.map((l) => l.accountId) } },
      select: { id: true, nature: true },
    });
    const natureById = new Map(accounts.map((a) => [a.id, a.nature]));

    for (const line of entry.lines) {
      const nature = natureById.get(line.accountId);
      if (!nature) {
        throw new Error(
          `Account ${line.accountId} not found during applyPost`,
        );
      }
      await this.upsertBalance(
        line.accountId,
        entry.periodId,
        entry.organizationId,
        positiveString(line.side.debit),
        positiveString(line.side.credit),
        nature,
      );
    }
  }

  async applyVoid(entry: Journal): Promise<void> {
    const accounts = await this.tx.account.findMany({
      where: { id: { in: entry.lines.map((l) => l.accountId) } },
      select: { id: true, nature: true },
    });
    const natureById = new Map(accounts.map((a) => [a.id, a.nature]));

    for (const line of entry.lines) {
      const nature = natureById.get(line.accountId);
      if (!nature) {
        throw new Error(
          `Account ${line.accountId} not found during applyVoid`,
        );
      }
      await this.upsertBalance(
        line.accountId,
        entry.periodId,
        entry.organizationId,
        negatedString(line.side.debit),
        negatedString(line.side.credit),
        nature,
      );
    }
  }

  private async upsertBalance(
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
    const record = await this.tx.accountBalance.upsert({
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
    const fresh = await this.tx.accountBalance.findUniqueOrThrow({
      where: { id: record.id },
    });

    // Paso 3: recalcular balance por nature y persistir.
    const balance =
      nature === "DEUDORA"
        ? fresh.debitTotal.minus(fresh.creditTotal)
        : fresh.creditTotal.minus(fresh.debitTotal);

    await this.tx.accountBalance.update({
      where: { id: record.id },
      data: { balance },
    });
  }
}
