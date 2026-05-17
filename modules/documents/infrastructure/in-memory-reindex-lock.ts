import type { ReindexLockPort } from "@/modules/documents/domain/ports/reindex-lock.port";

/**
 * InMemoryReindexLock — process-local per-org reindex gate (REQ-48).
 *
 * Backed by a `Set<string>` of currently-held orgIds. The composition root
 * MUST hand back a single shared instance to all consumers in the request
 * pipeline; otherwise concurrent requests will each see their own empty set
 * and the 409 contract collapses.
 *
 * Known limitation (design §4 + acknowledged in spec Risk 3): lock state is
 * lost on process restart and not shared across multi-process deployments.
 * Worst case: two parallel reindexes in different processes — REQ-47 delete+
 * insert is idempotent, so the only cost is wasted embedding spend. Out of
 * scope for this SDD.
 */
export class InMemoryReindexLock implements ReindexLockPort {
  private readonly held = new Set<string>();

  acquire(orgId: string): boolean {
    if (this.held.has(orgId)) return false;
    this.held.add(orgId);
    return true;
  }

  release(orgId: string): void {
    this.held.delete(orgId);
  }
}
