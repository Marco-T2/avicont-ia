import type { Journal } from "@/modules/accounting/domain/journal.entity";
import type { AccountBalancesRepository } from "@/modules/accounting/domain/ports/account-balances.repo";

/**
 * In-memory `AccountBalancesRepository` fake para purchase-hex application
 * tests. Espejo simétrico del fake sale-hex. Registra `applyPost` /
 * `applyVoid` para assertions de cascade ordering en post/void.
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
