import { describe, it, expect } from "vitest";
import {
  PAYMENT_METHODS,
  parsePaymentMethod,
  isBankTransfer,
} from "../../value-objects/payment-method";
import { InvalidPaymentMethod } from "../../errors/payment-errors";

describe("PaymentMethod VO", () => {
  describe("parsePaymentMethod()", () => {
    it.each(PAYMENT_METHODS)("accepts valid method %s", (method) => {
      expect(parsePaymentMethod(method)).toBe(method);
    });

    it("rejects unknown method with InvalidPaymentMethod", () => {
      expect(() => parsePaymentMethod("PAYPAL")).toThrow(InvalidPaymentMethod);
    });

    it("is case-sensitive (lowercase rejected)", () => {
      expect(() => parsePaymentMethod("efectivo")).toThrow(InvalidPaymentMethod);
    });
  });

  describe("isBankTransfer()", () => {
    it("returns true for TRANSFERENCIA", () => {
      expect(isBankTransfer("TRANSFERENCIA")).toBe(true);
    });

    it("returns true for DEPOSITO", () => {
      expect(isBankTransfer("DEPOSITO")).toBe(true);
    });

    it("returns false for EFECTIVO", () => {
      expect(isBankTransfer("EFECTIVO")).toBe(false);
    });

    it("returns false for CHEQUE", () => {
      expect(isBankTransfer("CHEQUE")).toBe(false);
    });
  });
});
