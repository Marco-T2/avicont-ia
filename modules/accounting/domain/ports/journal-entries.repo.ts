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
}
