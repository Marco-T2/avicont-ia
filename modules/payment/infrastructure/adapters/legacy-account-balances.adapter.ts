import "server-only";
import type { Prisma, AccountNature } from "@/generated/prisma/client";
import { AccountBalancesRepository } from "@/features/account-balances/account-balances.repository";
import type {
  AccountBalancesPort,
} from "../../domain/ports/account-balances.port";
import type { JournalEntrySnapshot } from "../../domain/ports/accounting.port";

/**
 * Adapter wrapping the legacy `AccountBalancesRepository.upsert` (called
 * once per entry line). The adapter is preferred over wrapping the legacy
 * `AccountBalancesService.applyPost` directly because:
 *
 *   - The service expects the rich `JournalEntryWithLines` row; we have the
 *     narrow JournalEntrySnapshot DTO with `accountNature` already on each
 *     line. Going through upsert keeps the adapter trivial — no double
 *     mapping.
 *   - Symmetry with the future C3 Prisma adapter: that one will own balance
 *     persistence directly when payment owns its own balances columns.
 */
export class LegacyAccountBalancesAdapter implements AccountBalancesPort {
  constructor(
    private readonly repo: AccountBalancesRepository = new AccountBalancesRepository(),
  ) {}

  async applyPostTx(
    tx: unknown,
    entry: JournalEntrySnapshot,
  ): Promise<void> {
    const txc = tx as Prisma.TransactionClient;
    for (const line of entry.lines) {
      await this.repo.upsert(
        txc,
        line.accountId,
        entry.periodId,
        entry.organizationId,
        line.debit.toString(),
        line.credit.toString(),
        line.accountNature as AccountNature,
      );
    }
  }

  async applyVoidTx(
    tx: unknown,
    entry: JournalEntrySnapshot,
  ): Promise<void> {
    const txc = tx as Prisma.TransactionClient;
    for (const line of entry.lines) {
      await this.repo.upsert(
        txc,
        line.accountId,
        entry.periodId,
        entry.organizationId,
        (-line.debit).toString(),
        (-line.credit).toString(),
        line.accountNature as AccountNature,
      );
    }
  }
}
