/**
 * Outbound port for account balance operations from dispatch-hex use cases.
 *
 * Mirror: sale-hex balance cascade pattern.
 * Adapter wraps legacy `AccountBalancesService.applyPost/applyVoid` from
 * features/account-balances — TEMPORARY bridge until account-balances migrates.
 *
 * Journal entry ID is the input — the adapter resolves the full journal from DB.
 */
export interface DispatchAccountBalancesPort {
  /** Apply post balances for a journal entry. */
  applyPost(journalEntryId: string): Promise<void>;

  /** Reverse balances for a journal entry (void cascade). */
  applyVoid(journalEntryId: string): Promise<void>;
}
