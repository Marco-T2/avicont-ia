import type { Journal } from "@/modules/accounting/domain/journal.entity";
import type { AccountBalancesRepository } from "@/modules/accounting/domain/ports/account-balances.repo";

/**
 * In-memory `AccountBalancesRepository` fake for sale-hex application tests.
 * Records every `applyPost` / `applyVoid` invocation so tests can assert
 * cascade ordering against `journalEntryFactory.calls` and
 * `receivableRepo.createTxCalls`.
 */
export class InMemoryAccountBalancesRepository
  implements AccountBalancesRepository
{
  applyPostCalls: Journal[] = [];
  applyVoidCalls: Journal[] = [];

  async applyPost(entry: Journal): Promise<void> {
    this.applyPostCalls.push(entry);
  }

  async applyVoid(entry: Journal): Promise<void> {
    this.applyVoidCalls.push(entry);
  }
}
