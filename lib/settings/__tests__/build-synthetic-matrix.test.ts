/**
 * PR4.1 [RED] — Tests for buildSyntheticMatrix()
 * REQ-RM.11
 *
 * Four tests must FAIL with "Cannot find module '@/lib/settings/build-synthetic-matrix'"
 * until PR4.2 [GREEN] creates the module.
 *
 * Environment: node (.test.ts — pure function, no DOM deps)
 */

import { describe, it, expect } from "vitest";
import type { Resource } from "@/features/shared/permissions";
import { buildSyntheticMatrix } from "@/lib/settings/build-synthetic-matrix";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rs(...resources: Resource[]): Set<Resource> {
  return new Set<Resource>(resources);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("buildSyntheticMatrix()", () => {
  // (a) canAccess(r, "read") returns readSet.has(r)
  it("(a) canAccess(r, 'read') returns true iff resource is in readSet", () => {
    const matrix = buildSyntheticMatrix(rs("journal", "farms"), rs());
    expect(matrix.canAccess("journal", "read")).toBe(true);
    expect(matrix.canAccess("farms", "read")).toBe(true);
    expect(matrix.canAccess("sales", "read")).toBe(false);
    expect(matrix.canAccess("members", "read")).toBe(false);
  });

  // (b) canAccess(r, "write") returns writeSet.has(r)
  it("(b) canAccess(r, 'write') returns true iff resource is in writeSet", () => {
    const matrix = buildSyntheticMatrix(rs(), rs("sales", "purchases"));
    expect(matrix.canAccess("sales", "write")).toBe(true);
    expect(matrix.canAccess("purchases", "write")).toBe(true);
    expect(matrix.canAccess("journal", "write")).toBe(false);
    expect(matrix.canAccess("farms", "write")).toBe(false);
  });

  // (c) readSet and writeSet are independent — one does not influence the other
  it("(c) readSet and writeSet produce independent results", () => {
    // journal is in readSet only; sales is in writeSet only
    const matrix = buildSyntheticMatrix(rs("journal"), rs("sales"));
    expect(matrix.canAccess("journal", "read")).toBe(true);
    expect(matrix.canAccess("journal", "write")).toBe(false);
    expect(matrix.canAccess("sales", "read")).toBe(false);
    expect(matrix.canAccess("sales", "write")).toBe(true);
  });

  // (d) SyntheticMatrix does NOT expose canPost — this is a TypeScript compile-time check.
  // At runtime we verify the returned object has no canPost property.
  it("(d) returned object does NOT have a canPost property", () => {
    const matrix = buildSyntheticMatrix(rs("journal"), rs("journal"));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((matrix as any).canPost).toBeUndefined();
    // Only canAccess should be present
    expect(typeof matrix.canAccess).toBe("function");
  });
});
