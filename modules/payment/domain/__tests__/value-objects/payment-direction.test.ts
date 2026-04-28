import { describe, it, expect } from "vitest";
import {
  PAYMENT_DIRECTIONS,
  parsePaymentDirection,
  type PaymentDirection,
} from "../../value-objects/payment-direction";
import { InvalidPaymentDirection } from "../../errors/payment-errors";

describe("PaymentDirection VO", () => {
  describe("parsePaymentDirection()", () => {
    it.each(PAYMENT_DIRECTIONS)("accepts valid direction %s", (direction) => {
      expect(parsePaymentDirection(direction)).toBe(direction);
    });

    it("rejects unknown direction with InvalidPaymentDirection", () => {
      expect(() => parsePaymentDirection("AMBOS")).toThrow(InvalidPaymentDirection);
    });

    it("is case-sensitive (lowercase rejected)", () => {
      expect(() => parsePaymentDirection("cobro")).toThrow(InvalidPaymentDirection);
    });

    it("returns the same direction string", () => {
      const result: PaymentDirection = parsePaymentDirection("COBRO");
      expect(result).toBe("COBRO");
    });
  });
});
