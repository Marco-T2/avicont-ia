import type { Journal } from "../journal.entity";

/**
 * Tx-aware port for account_balances writes. Held inside `AccountingScope` so
 * the application layer never sees a `tx` token directly — the UoW adapter
 * (POC #9) wires the implementation against the open transaction.
 *
 * The Prisma adapter (C3) wraps the legacy `AccountBalancesService.applyPost`
 * / `applyVoid` operations under the open transaction.
 *
 * Strict TDD per-test: only `applyPost` lands in C2-B (createAndPost). The
 * `applyVoid` counterpart is added in the sub-fase that first exercises a
 * VOIDED transition (C2-C transitionStatus or C2-D updateEntry — whichever
 * lands the case first).
 */
export interface AccountBalancesRepository {
  applyPost(entry: Journal): Promise<void>;
}
