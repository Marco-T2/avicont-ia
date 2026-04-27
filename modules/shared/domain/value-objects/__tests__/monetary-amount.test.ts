import { describe, it, expect } from "vitest";
import { MonetaryAmount } from "../monetary-amount";
import { InvalidMonetaryAmount } from "../../errors/monetary-errors";

describe("MonetaryAmount VO", () => {
  describe("of()", () => {
    it("constructs with positive number, exposes value", () => {
      const m = MonetaryAmount.of(150.5);
      expect(m.value).toBe(150.5);
    });

    it("constructs from string representation", () => {
      const m = MonetaryAmount.of("250.75");
      expect(m.value).toBe(250.75);
    });

    it("normalizes to 2 decimal places (banker-safe rounding)", () => {
      const m = MonetaryAmount.of(10.005);
      expect(m.value).toBeCloseTo(10.01, 2);
    });

    it("allows zero", () => {
      const m = MonetaryAmount.of(0);
      expect(m.value).toBe(0);
    });

    it("rejects negative numbers", () => {
      expect(() => MonetaryAmount.of(-1)).toThrow(InvalidMonetaryAmount);
    });

    it("rejects NaN", () => {
      expect(() => MonetaryAmount.of(NaN)).toThrow(InvalidMonetaryAmount);
    });

    it("rejects Infinity", () => {
      expect(() => MonetaryAmount.of(Infinity)).toThrow(InvalidMonetaryAmount);
    });

    it("rejects values above Decimal(12,2) max", () => {
      expect(() => MonetaryAmount.of(10_000_000_000)).toThrow(InvalidMonetaryAmount);
    });

    it("rejects unparseable strings", () => {
      expect(() => MonetaryAmount.of("abc")).toThrow(InvalidMonetaryAmount);
    });
  });

  describe("zero()", () => {
    it("returns a zero amount", () => {
      expect(MonetaryAmount.zero().value).toBe(0);
    });
  });

  describe("arithmetic", () => {
    it("plus() adds two amounts", () => {
      const a = MonetaryAmount.of(100);
      const b = MonetaryAmount.of(50.25);
      expect(a.plus(b).value).toBe(150.25);
    });

    it("minus() subtracts two amounts", () => {
      const a = MonetaryAmount.of(100);
      const b = MonetaryAmount.of(30.5);
      expect(a.minus(b).value).toBe(69.5);
    });

    it("minus() throws if result is negative", () => {
      const a = MonetaryAmount.of(50);
      const b = MonetaryAmount.of(100);
      expect(() => a.minus(b)).toThrow(InvalidMonetaryAmount);
    });

    it("minus() returning 0 is allowed", () => {
      const a = MonetaryAmount.of(50);
      const b = MonetaryAmount.of(50);
      expect(a.minus(b).value).toBe(0);
    });

    it("rounds arithmetic results to 2 decimals", () => {
      const a = MonetaryAmount.of(0.1);
      const b = MonetaryAmount.of(0.2);
      // 0.1 + 0.2 = 0.30000000000000004 in JS
      expect(a.plus(b).value).toBe(0.3);
    });
  });

  describe("comparisons", () => {
    it("equals() compares two amounts", () => {
      expect(MonetaryAmount.of(100).equals(MonetaryAmount.of(100))).toBe(true);
      expect(MonetaryAmount.of(100).equals(MonetaryAmount.of(99.99))).toBe(false);
    });

    it("isGreaterThan() compares two amounts", () => {
      expect(MonetaryAmount.of(100).isGreaterThan(MonetaryAmount.of(50))).toBe(true);
      expect(MonetaryAmount.of(50).isGreaterThan(MonetaryAmount.of(100))).toBe(false);
      expect(MonetaryAmount.of(50).isGreaterThan(MonetaryAmount.of(50))).toBe(false);
    });

    it("isLessThan() compares two amounts", () => {
      expect(MonetaryAmount.of(50).isLessThan(MonetaryAmount.of(100))).toBe(true);
      expect(MonetaryAmount.of(100).isLessThan(MonetaryAmount.of(50))).toBe(false);
    });
  });
});
