import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { AccountBalancesRepository } from "@/modules/account-balances/infrastructure/account-balances.repository";
import type { AccountBalanceWithRelations } from "@/modules/account-balances/infrastructure/account-balances.types";
import type { JournalEntryWithLines } from "@/modules/accounting/presentation/dto/journal.types";

export class AccountBalancesService {
  private readonly repo: AccountBalancesRepository;

  constructor(repo?: AccountBalancesRepository) {
    this.repo = repo ?? new AccountBalancesRepository();
  }

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
    tx: Prisma.TransactionClient,
    entry: JournalEntryWithLines,
  ): Promise<void> {
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
    tx: Prisma.TransactionClient,
    entry: JournalEntryWithLines,
  ): Promise<void> {
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
