import { describe, it, expect } from "vitest";
import {
  PAYABLE_STATUSES,
  canTransition,
  parsePayableStatus,
  type PayableStatus,
} from "../payable-status";
import { InvalidPayableStatus } from "../../errors/payable-errors";

describe("PayableStatus VO", () => {
  describe("parsePayableStatus()", () => {
    it.each(PAYABLE_STATUSES)("accepts valid status %s", (status) => {
      expect(parsePayableStatus(status)).toBe(status);
    });

    it("rejects unknown status", () => {
      expect(() => parsePayableStatus("FOO")).toThrow(InvalidPayableStatus);
    });

    it("is case-sensitive (lowercase rejected)", () => {
      expect(() => parsePayableStatus("pending")).toThrow(InvalidPayableStatus);
    });
  });

  describe("canTransition()", () => {
    const cases: Array<[PayableStatus, PayableStatus, boolean]> = [
      // PENDING → PARTIAL/PAID/VOIDED/OVERDUE allowed; PENDING→CANCELLED nope
      ["PENDING", "PARTIAL", true],
      ["PENDING", "PAID", true],
      ["PENDING", "VOIDED", true],
      ["PENDING", "OVERDUE", true],
      ["PENDING", "CANCELLED", false],
      ["PENDING", "PENDING", false],
      // PARTIAL → PAID/VOIDED/OVERDUE allowed
      ["PARTIAL", "PAID", true],
      ["PARTIAL", "VOIDED", true],
      ["PARTIAL", "OVERDUE", true],
      ["PARTIAL", "PENDING", false],
      ["PARTIAL", "CANCELLED", false],
      // OVERDUE → PARTIAL/PAID/VOIDED allowed
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
