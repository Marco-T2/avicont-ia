import { describe, it, expect } from "vitest";
import {
  RECEIVABLE_STATUSES,
  canTransition,
  parseReceivableStatus,
  type ReceivableStatus,
} from "../receivable-status";
import { InvalidReceivableStatus } from "../../errors/receivable-errors";

describe("ReceivableStatus VO", () => {
  describe("parseReceivableStatus()", () => {
    it.each(RECEIVABLE_STATUSES)("accepts valid status %s", (status) => {
      expect(parseReceivableStatus(status)).toBe(status);
    });

    it("rejects unknown status", () => {
      expect(() => parseReceivableStatus("FOO")).toThrow(InvalidReceivableStatus);
    });

    it("is case-sensitive (lowercase rejected)", () => {
      expect(() => parseReceivableStatus("pending")).toThrow(InvalidReceivableStatus);
    });
  });

  describe("canTransition()", () => {
    const cases: Array<[ReceivableStatus, ReceivableStatus, boolean]> = [
      // PENDING → PARTIAL/PAID/VOIDED allowed; OVERDUE unreachable (DEC-A); CANCELLED nope
      ["PENDING", "PARTIAL", true],
      ["PENDING", "PAID", true],
      ["PENDING", "VOIDED", true],
      ["PENDING", "OVERDUE", false],
      ["PENDING", "CANCELLED", false],
      ["PENDING", "PENDING", false],
      // PARTIAL → PAID/VOIDED allowed; OVERDUE unreachable (DEC-A)
      ["PARTIAL", "PAID", true],
      ["PARTIAL", "VOIDED", true],
      ["PARTIAL", "OVERDUE", false],
      ["PARTIAL", "PENDING", false],
      ["PARTIAL", "CANCELLED", false],
      // OVERDUE → entry closed, exit OPEN (DEC-A + Batch 3-FIX F-2): no row can
      // newly ENTER OVERDUE, but a legacy row already in it must be able to
      // drain (pay or void) — `OVERDUE: []` walled rows in and made sale/purchase
      // void roll back on `.void()`.
      ["OVERDUE", "PARTIAL", true],
      ["OVERDUE", "PAID", true],
      ["OVERDUE", "VOIDED", true],
      ["OVERDUE", "PENDING", false],
      // PAID → terminal
      ["PAID", "PENDING", false],
      ["PAID", "PARTIAL", false],
      ["PAID", "VOIDED", false],
      // VOIDED → terminal
      ["VOIDED", "PENDING", false],
      ["VOIDED", "PARTIAL", false],
      ["VOIDED", "PAID", false],
      // CANCELLED → terminal (compat)
      ["CANCELLED", "PENDING", false],
      ["CANCELLED", "PAID", false],
    ];

    it.each(cases)("canTransition(%s, %s) = %s", (from, to, expected) => {
      expect(canTransition(from, to)).toBe(expected);
    });
  });
});
