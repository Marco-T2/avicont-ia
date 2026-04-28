import type { JournalEntrySnapshot } from "./accounting.port";

/**
 * Cross-feature port for the slice of `features/account-balances/` the payment
 * module consumes. Wraps `AccountBalancesService.applyPost` / `applyVoid`,
 * which upsert per-(account, period) balance rows derived from the journal
 * entry's lines.
 *
 * Tx-aware: signatures take `tx: unknown`; adapter casts internally.
 *
 * The entry snapshot carries `accountNature` per line, so the adapter does
 * not need to load account rows again — keeps balance application a single
 * pass over the lines.
 */
export interface AccountBalancesPort {
  /**
   * Apply balance increments for a POSTED journal entry. Idempotent at the
   * upsert level — calling twice with the same entry doubles the balance
   * (caller is responsible for not double-applying).
   */
  applyPostTx(tx: unknown, entry: JournalEntrySnapshot): Promise<void>;

  /**
   * Reverse balance increments for a VOIDED journal entry. Negates each
   * line's debit/credit and upserts.
   */
  applyVoidTx(tx: unknown, entry: JournalEntrySnapshot): Promise<void>;
}
