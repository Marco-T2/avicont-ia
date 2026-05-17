/**
 * ReindexLockPort — per-organization concurrency gate for reindex ops (REQ-48).
 *
 * Contract (design §4): a single composition-root instance enforces that, for
 * any given orgId, at most one reindex runs at a time across all documents
 * within that org. `acquire(orgId)` returns false when the lock is held —
 * route handlers map false → HTTP 409. `release(orgId)` must always run
 * in a finally so a failing reindex never strands the lock.
 */
export interface ReindexLockPort {
  /** Try to acquire the lock for the given organization. Returns true if
   * acquired, false if another reindex is already in flight for that org. */
  acquire(orgId: string): boolean;
  /** Release the lock. No-op when no lock is held for the given orgId. */
  release(orgId: string): void;
}
