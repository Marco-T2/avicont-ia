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

  /**
   * Persists a header (and optional lines) update on an existing aggregate.
   * The aggregate is already mutated in-memory by the use case (`current.
   * update(input).replaceLines(drafts?)`), so the adapter writes the new
   * header fields plus, when lines were replaced, deletes-and-recreates the
   * line rows (parity legacy `repo.updateTx` `journal.service.ts:411/421/456`).
   * Returns the persisted aggregate hydrated from DB so the caller can pass
   * it to `accountBalances.applyPost` / `applyVoid` for the POSTED revert-
   * rewrite-reapply flow with `lines`, `account.nature` etc populated by the
   * adapter.
   *
   * I7 (VOIDED inmutable) and I9 (sourceType !== null inmutable via accounting
   * API) are enforced by `assertMutable` inside the aggregate at `current.
   * update(...)` time; the adapter does NOT re-validate. I1 (partida doble)
   * is enforced by `assertBalanced` inside `replaceLines` ONLY when the
   * aggregate's status is POSTED — DRAFT / LOCKED parity-skip the balance
   * check (legacy `journal.service.ts` validates balance only inside the
   * POSTED branch l352-358).
   */
  update(journal: Journal): Promise<Journal>;
}
