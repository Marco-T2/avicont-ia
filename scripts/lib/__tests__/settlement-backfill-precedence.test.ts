/**
 * Per-branch unit tests for the backfill precedence derivation
 * (settlement-invariant-hardening, D-2 / spec "Precedence derivation as pure
 * module").
 *
 * One test per locked D4 precedence branch:
 *   1. last-wins: createdAt DESC
 *   2. id DESC tie-break (equal createdAt)
 *   3. CxC-over-CxP when both sides link the same JE
 *   4. CANCELLED → VOIDED collapse (shared toSettlementStatus)
 *   5. OVERDUE → PENDING collapse — exercised via the AP-only path, which
 *      also pins the `ar ?? ap` fallback branch
 *   6. unlinked (no aux rows on either side) → null
 *
 * NO SQL replay test by design — these assert the TS re-derivation only; the
 * gate script (scripts/verify-je-settlement-backfill.ts) consumes this module
 * and compares against live rows.
 */
import { describe, expect, it } from "vitest";

import {
  type AuxRow,
  deriveExpectedSettlement,
  pickCrossSideWinner,
  pickWinner,
} from "../settlement-backfill-precedence";

const row = (overrides: Partial<AuxRow> & Pick<AuxRow, "id">): AuxRow => ({
  journalEntryId: "je-1",
  status: "PENDING",
  dueDate: new Date("2026-01-15T00:00:00.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

describe("pickWinner — deterministic last-wins (createdAt DESC, id DESC)", () => {
  it("picks the row with the latest createdAt (last-wins)", () => {
    const older = row({
      id: "aux-old",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const newer = row({
      id: "aux-new",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
    });

    expect(pickWinner([older, newer])).toBe(newer);
    // Input order must not matter — sort is the contract, not array position.
    expect(pickWinner([newer, older])).toBe(newer);
  });

  it("breaks createdAt ties by id DESC", () => {
    const sameInstant = new Date("2026-02-01T00:00:00.000Z");
    const lowId = row({ id: "aux-a", createdAt: sameInstant });
    const highId = row({ id: "aux-b", createdAt: sameInstant });

    expect(pickWinner([lowId, highId])).toBe(highId);
    expect(pickWinner([highId, lowId])).toBe(highId);
  });
});

describe("deriveExpectedSettlement — side preference and collapse", () => {
  it("prefers CxC over CxP when both sides link the JE (dual-linked)", () => {
    const ar = row({
      id: "ar-1",
      status: "PARTIAL",
      dueDate: new Date("2026-04-10T00:00:00.000Z"),
      // Older than the AP row — side preference must beat recency.
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const ap = row({
      id: "ap-1",
      status: "PAID",
      dueDate: new Date("2026-05-20T00:00:00.000Z"),
      createdAt: new Date("2026-02-01T00:00:00.000Z"),
    });

    expect(deriveExpectedSettlement([ar], [ap])).toEqual({
      status: "PARTIAL",
      dueDate: new Date("2026-04-10T00:00:00.000Z"),
    });
  });

  it("collapses CANCELLED to VOIDED via the shared mapper", () => {
    const ar = row({
      id: "ar-cancelled",
      status: "CANCELLED",
      dueDate: new Date("2026-06-01T00:00:00.000Z"),
    });

    expect(deriveExpectedSettlement([ar], [])).toEqual({
      status: "VOIDED",
      dueDate: new Date("2026-06-01T00:00:00.000Z"),
    });
  });

  it("collapses OVERDUE to PENDING on the AP-only fallback path", () => {
    const ap = row({
      id: "ap-overdue",
      status: "OVERDUE",
      dueDate: new Date("2026-07-01T00:00:00.000Z"),
    });

    // arRows empty → `ar ?? ap` fallback engages AND the collapse applies.
    expect(deriveExpectedSettlement([], [ap])).toEqual({
      status: "PENDING",
      dueDate: new Date("2026-07-01T00:00:00.000Z"),
    });
  });

  it("returns null when no aux row links the JE on either side (unlinked)", () => {
    expect(deriveExpectedSettlement([], [])).toBeNull();
  });
});

describe("pickCrossSideWinner — winning row exposed for gate diagnostics", () => {
  it("returns the AR winner when both sides link (CxC-over-CxP), the AP winner on fallback", () => {
    const ar = row({
      id: "ar-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const ap = row({
      id: "ap-1",
      // Newer than the AR row — side preference must still win.
      createdAt: new Date("2026-02-01T00:00:00.000Z"),
    });

    expect(pickCrossSideWinner([ar], [ap])).toBe(ar);
    expect(pickCrossSideWinner([], [ap])).toBe(ap);
    expect(pickCrossSideWinner([], [])).toBeUndefined();
  });
});
