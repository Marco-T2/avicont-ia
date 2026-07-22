import "server-only";
import type { AccountBalancesRepositoryPort } from "@/modules/account-balances/domain/ports/account-balances-repository.port";
import type { AccountBalanceWithRelations } from "@/modules/account-balances/domain/account-balances.types";
import type { JournalEntryWithLines } from "@/modules/accounting/domain/journal.types";

export class AccountBalancesService {
  constructor(private readonly repo: AccountBalancesRepositoryPort) {}

  // ── Get balances for a period, optionally filtered by account ──

  async getBalances(
    orgId: string,
    periodId: string,
    accountId?: string,
  ): Promise<AccountBalanceWithRelations[]> {
    return this.repo.findByPeriod(orgId, periodId, accountId);
  }

  // ── Apply balance increments when a journal entry is POSTED ──

  async applyPost(
    tx: unknown,
    entry: JournalEntryWithLines,
  ): Promise<void> {
    // Opaque-token pattern (R5, closed): `tx` stays `unknown` end-to-end --
    // the port's `upsert` also declares it `unknown`, so no cast is needed
    // here. The concrete adapter narrows it to `Prisma.TransactionClient`.
    for (const line of entry.lines) {
      await this.repo.upsert(
        tx,
        line.accountId,
        entry.periodId,
        entry.organizationId,
        line.debit.toString(),
        line.credit.toString(),
        line.account.nature,
      );
    }
  }

  // ── Reverse balance when a journal entry is VOIDED ──

  async applyVoid(
    tx: unknown,
    entry: JournalEntryWithLines,
  ): Promise<void> {
    // See applyPost above for the opaque-token / R5 rationale.
    for (const line of entry.lines) {
      await this.repo.upsert(
        tx,
        line.accountId,
        entry.periodId,
        entry.organizationId,
        line.debit.negated().toString(),
        line.credit.negated().toString(),
        line.account.nature,
      );
    }
  }
}
