import type { Journal } from "../journal.entity";

/**
 * Tx-aware port for account_balances writes. Held inside `AccountingScope` so
 * the application layer never sees a `tx` token directly — the UoW adapter
 * (POC #9) wires the implementation against the open transaction.
 *
 * The Prisma adapter (C3) wraps the legacy `AccountBalancesService.applyPost`
 * / `applyVoid` operations under the open transaction.
 *
 * `applyPost` landed in C2-B (createAndPost); `applyVoid` lands in C2-C
 * transitionStatus when the first VOIDED transition is exercised.
 */
export interface AccountBalancesRepository {
  applyPost(entry: Journal): Promise<void>;
  applyVoid(entry: Journal): Promise<void>;
}
