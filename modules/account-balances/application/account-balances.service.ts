import "server-only";
import { AccountBalancesRepository } from "@/modules/account-balances/infrastructure/account-balances.repository";
import type { AccountBalanceWithRelations } from "@/modules/account-balances/infrastructure/account-balances.types";
import type { JournalEntryWithLines } from "@/modules/accounting/domain/journal.types";

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
    tx: unknown,
    entry: JournalEntryWithLines,
  ): Promise<void> {
    // Opaque-token pattern (R5): `tx` arrives untyped so this application
    // file never imports `@/generated/prisma/*`. `Parameters<...>[0]` pulls
    // the exact type `AccountBalancesRepository.upsert` expects (infra is
    // R5-exempt) without naming `Prisma.TransactionClient` here.
    const db = tx as Parameters<AccountBalancesRepository["upsert"]>[0];
    for (const line of entry.lines) {
      await this.repo.upsert(
        db,
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
    const db = tx as Parameters<AccountBalancesRepository["upsert"]>[0];
    for (const line of entry.lines) {
      await this.repo.upsert(
        db,
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
