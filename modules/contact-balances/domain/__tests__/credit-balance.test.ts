import { describe, it, expect } from "vitest";
import { CreditBalance } from "../value-objects/credit-balance";

describe("CreditBalance.fromPayments", () => {
  it("returns 0 when there are no payments", () => {
    expect(CreditBalance.fromPayments([]).toNumber()).toBe(0);
  });

  it("sums payment amounts and subtracts non-voided allocations", () => {
    const credit = CreditBalance.fromPayments([
      {
        amount: 1000,
        allocations: [
          { amount: 300, targetVoided: false },
          { amount: 200, targetVoided: false },
        ],
      },
    ]);
    expect(credit.toNumber()).toBe(500);
  });

  it("ignores allocations whose target is voided", () => {
    const credit = CreditBalance.fromPayments([
      {
        amount: 1000,
        allocations: [
          { amount: 300, targetVoided: true },
          { amount: 200, targetVoided: false },
        ],
      },
    ]);
    expect(credit.toNumber()).toBe(800);
  });

  it("aggregates across multiple payments", () => {
    const credit = CreditBalance.fromPayments([
      { amount: 500, allocations: [{ amount: 200, targetVoided: false }] },
      { amount: 300, allocations: [] },
    ]);
    expect(credit.toNumber()).toBe(600);
  });

  it("clamps a negative net to zero (over-allocation defense)", () => {
    const credit = CreditBalance.fromPayments([
      {
        amount: 100,
        allocations: [{ amount: 500, targetVoided: false }],
      },
    ]);
    expect(credit.toNumber()).toBe(0);
  });
});
