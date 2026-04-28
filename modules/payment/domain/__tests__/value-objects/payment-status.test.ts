import { describe, it, expect } from "vitest";
import {
  PAYMENT_STATUSES,
  canTransition,
  parsePaymentStatus,
  type PaymentStatus,
} from "../../value-objects/payment-status";
import { InvalidPaymentStatus } from "../../errors/payment-errors";

describe("PaymentStatus VO", () => {
  describe("parsePaymentStatus()", () => {
    it.each(PAYMENT_STATUSES)("accepts valid status %s", (status) => {
      expect(parsePaymentStatus(status)).toBe(status);
    });

    it("rejects unknown status with InvalidPaymentStatus", () => {
      expect(() => parsePaymentStatus("FOO")).toThrow(InvalidPaymentStatus);
    });

    it("is case-sensitive (lowercase rejected)", () => {
      expect(() => parsePaymentStatus("draft")).toThrow(InvalidPaymentStatus);
    });
  });

  describe("canTransition()", () => {
    const cases: Array<[PaymentStatus, PaymentStatus, boolean]> = [
      // DRAFT → POSTED only
      ["DRAFT", "POSTED", true],
      ["DRAFT", "LOCKED", false],
      ["DRAFT", "VOIDED", false],
      ["DRAFT", "DRAFT", false],
      // POSTED → LOCKED / VOIDED
      ["POSTED", "LOCKED", true],
      ["POSTED", "VOIDED", true],
      ["POSTED", "DRAFT", false],
      // LOCKED → VOIDED only
      ["LOCKED", "VOIDED", true],
      ["LOCKED", "DRAFT", false],
      ["LOCKED", "POSTED", false],
      // VOIDED → terminal
      ["VOIDED", "DRAFT", false],
      ["VOIDED", "POSTED", false],
      ["VOIDED", "LOCKED", false],
    ];

    it.each(cases)("canTransition(%s, %s) = %s", (from, to, expected) => {
      expect(canTransition(from, to)).toBe(expected);
    });
  });
});
