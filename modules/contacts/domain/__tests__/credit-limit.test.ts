import { describe, it, expect } from "vitest";
import { CreditLimit } from "../value-objects/credit-limit";
import { InvalidCreditLimit } from "../errors/contact-errors";

describe("CreditLimit", () => {
  it("accepts zero", () => {
    expect(CreditLimit.of(0).value).toBe(0);
  });

  it("accepts a positive value", () => {
    expect(CreditLimit.of(1500.5).value).toBe(1500.5);
  });

  it("rejects negative values", () => {
    expect(() => CreditLimit.of(-0.01)).toThrow(InvalidCreditLimit);
  });

  it("rejects NaN", () => {
    expect(() => CreditLimit.of(Number.NaN)).toThrow(InvalidCreditLimit);
  });

  it("rejects Infinity", () => {
    expect(() => CreditLimit.of(Number.POSITIVE_INFINITY)).toThrow(InvalidCreditLimit);
  });

  it("equals returns true for same numeric value", () => {
    expect(CreditLimit.of(100).equals(CreditLimit.of(100))).toBe(true);
  });

  it("equals returns false for different values", () => {
    expect(CreditLimit.of(100).equals(CreditLimit.of(200))).toBe(false);
  });
});
