import { describe, expect, it } from "vitest";
import { LotSummary } from "../lot-summary";

describe("LotSummary VO behavioral", () => {
  // α33
  it("LotSummary.compute with expenses + mortalityLogs computes all fields", () => {
    const summary = LotSummary.compute({
      initialCount: 1000,
      expenses: [{ amount: 100 }, { amount: 200 }],
      mortalityLogs: [{ count: 50 }],
    });
    expect(summary.totalExpenses).toBe(300);
    expect(summary.totalMortality).toBe(50);
    expect(summary.aliveCount).toBe(950);
    expect(summary.costPerChicken).toBeCloseTo(300 / 950);
  });

  // α34
  it("LotSummary getters expose all fields", () => {
    const summary = LotSummary.compute({
      initialCount: 100,
      expenses: [{ amount: 50 }],
      mortalityLogs: [],
    });
    expect(summary.totalExpenses).toBe(50);
    expect(summary.totalMortality).toBe(0);
    expect(summary.aliveCount).toBe(100);
    expect(summary.costPerChicken).toBe(0.5);
  });

  // α35
  it("LotSummary.compute with totalMortality >= initialCount clamps aliveCount to 0 + costPerChicken to 0 (zero-div protection)", () => {
    const summary = LotSummary.compute({
      initialCount: 100,
      expenses: [{ amount: 500 }],
      mortalityLogs: [{ count: 100 }, { count: 50 }],
    });
    expect(summary.aliveCount).toBe(0);
    expect(summary.costPerChicken).toBe(0);
  });
});
