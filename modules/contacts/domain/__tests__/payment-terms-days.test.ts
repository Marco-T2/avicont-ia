import { describe, it, expect } from "vitest";
import { PaymentTermsDays } from "../value-objects/payment-terms-days";
import { InvalidPaymentTermsDays } from "../errors/contact-errors";

describe("PaymentTermsDays", () => {
  it("accepts a value at the lower bound (0)", () => {
    expect(PaymentTermsDays.of(0).value).toBe(0);
  });

  it("accepts a value at the upper bound (365)", () => {
    expect(PaymentTermsDays.of(365).value).toBe(365);
  });

  it("accepts the conventional default (30)", () => {
    expect(PaymentTermsDays.of(30).value).toBe(30);
  });

  it("rejects negative values", () => {
    expect(() => PaymentTermsDays.of(-1)).toThrow(InvalidPaymentTermsDays);
  });

  it("rejects values above 365", () => {
    expect(() => PaymentTermsDays.of(366)).toThrow(InvalidPaymentTermsDays);
  });

  it("rejects non-integer values", () => {
    expect(() => PaymentTermsDays.of(15.5)).toThrow(InvalidPaymentTermsDays);
  });

  it("rejects NaN", () => {
    expect(() => PaymentTermsDays.of(Number.NaN)).toThrow(InvalidPaymentTermsDays);
  });

  it("default() returns 30", () => {
    expect(PaymentTermsDays.default().value).toBe(30);
  });

  it("equals returns true for same value", () => {
    expect(PaymentTermsDays.of(30).equals(PaymentTermsDays.of(30))).toBe(true);
  });
});
