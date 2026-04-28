import type { Journal } from "../journal.entity";

/**
 * Tx-aware port for journal_entries writes. Held inside `AccountingScope` so
 * the application layer never sees a `tx` token directly — the UoW adapter
 * (POC #9) constructs the implementation against the open transaction.
 *
 * The Prisma adapter (C3) is responsible for the legacy infra concerns this
 * port hides:
 *   - sequential `number` allocation with retry on VOUCHER_NUMBER_CONTENTION,
 *   - P2002 → REFERENCE_NUMBER_DUPLICATE translation.
 *
 * The application layer just calls `create(journal)` and gets back a hydrated
 * aggregate with `number` populated.
 */
export interface JournalEntriesRepository {
  /**
   * Persists a freshly-created `Journal` aggregate. Returns a new aggregate
   * with the auto-generated `number` populated by the adapter.
   */
  create(journal: Journal): Promise<Journal>;

  /**
   * Persists a status transition for an existing aggregate. The aggregate is
   * already transitioned in-memory by the use case (`current.post()/lock()/
   * void()`), so the adapter only writes the new `status` (plus `updatedById`
   * = `userId`) — it does NOT re-validate I5/I7/I1, those live in the
   * aggregate. Returns the persisted aggregate hydrated from DB so the caller
   * can pass it to `accountBalances.applyPost` / `applyVoid` with `lines`,
   * `account.nature` etc populated by the adapter (parity with legacy
   * `updateStatusTx` returning `JournalEntryWithLines`).
   */
  updateStatus(journal: Journal, userId: string): Promise<Journal>;
}
