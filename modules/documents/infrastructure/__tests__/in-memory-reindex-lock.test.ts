/**
 * F6 C6.0 RED → GREEN — ReindexLockPort + InMemoryReindexLock (REQ-48).
 *
 * Locks the per-org concurrency contract:
 *   - acquire(orgId) returns true the first time and false while the same
 *     orgId is held; release(orgId) clears it; different orgIds never
 *     interfere.
 *
 * Expected RED failure (pre-GREEN): the module under test does not exist —
 * `../in-memory-reindex-lock` (and the port file) resolve to "Cannot find
 * module", failing every it() before any assertion runs. That IS the right
 * reason (adapter not implemented yet).
 */
import { describe, it, expect } from "vitest";
import { InMemoryReindexLock } from "../in-memory-reindex-lock";

describe("InMemoryReindexLock (REQ-48 per-org concurrency)", () => {
  it("acquire returns true on first call for a given orgId", () => {
    const lock = new InMemoryReindexLock();
    expect(lock.acquire("org-1")).toBe(true);
  });

  it("acquire returns false while the same orgId is held", () => {
    const lock = new InMemoryReindexLock();
    lock.acquire("org-1");
    expect(lock.acquire("org-1")).toBe(false);
  });

  it("release clears the lock; subsequent acquire returns true", () => {
    const lock = new InMemoryReindexLock();
    lock.acquire("org-1");
    lock.release("org-1");
    expect(lock.acquire("org-1")).toBe(true);
  });

  it("different orgIds do not interfere", () => {
    const lock = new InMemoryReindexLock();
    expect(lock.acquire("org-1")).toBe(true);
    expect(lock.acquire("org-2")).toBe(true);
    // Both should be held independently.
    expect(lock.acquire("org-1")).toBe(false);
    expect(lock.acquire("org-2")).toBe(false);
    lock.release("org-1");
    expect(lock.acquire("org-1")).toBe(true);
    expect(lock.acquire("org-2")).toBe(false);
  });

  it("release on a not-held orgId is a no-op", () => {
    const lock = new InMemoryReindexLock();
    expect(() => lock.release("never-held")).not.toThrow();
    expect(lock.acquire("never-held")).toBe(true);
  });
});
