import { describe, expect, it } from "vitest";
import { computeTrimPlan } from "../compute-trim-plan";
import type { AllocationLifoSnapshot } from "@/modules/payables/domain/payable.repository";

function alloc(
  id: string,
  amount: number,
  paymentDate = new Date("2025-01-15"),
): AllocationLifoSnapshot {
  return { id, amount, payment: { date: paymentDate } };
}

describe("computeTrimPlan (purchase)", () => {
  it("returns empty when excess is 0", () => {
    expect(computeTrimPlan([alloc("a1", 100)], 0)).toEqual([]);
  });

  it("returns empty when allocations list is empty", () => {
    expect(computeTrimPlan([], 50)).toEqual([]);
  });

  it("trims only the first allocation when excess fits in it", () => {
    const allocations = [alloc("a1", 100), alloc("a2", 50)];

    const plan = computeTrimPlan(allocations, 30);

    expect(plan).toEqual([
      {
        allocationId: "a1",
        paymentDate: "2025-01-15",
        originalAmount: "100.00",
        trimmedTo: "70.00",
      },
    ]);
  });

  it("cascades LIFO across allocations when excess exceeds the first", () => {
    const allocations = [
      alloc("a1", 100, new Date("2025-03-01")),
      alloc("a2", 80, new Date("2025-02-01")),
      alloc("a3", 60, new Date("2025-01-01")),
    ];

    const plan = computeTrimPlan(allocations, 150);

    expect(plan).toHaveLength(2);
    expect(plan[0]).toEqual({
      allocationId: "a1",
      paymentDate: "2025-03-01",
      originalAmount: "100.00",
      trimmedTo: "0.00",
    });
    expect(plan[1]).toEqual({
      allocationId: "a2",
      paymentDate: "2025-02-01",
      originalAmount: "80.00",
      trimmedTo: "30.00",
    });
  });

  it("zeroes the entire allocation when excess equals its full amount", () => {
    const plan = computeTrimPlan([alloc("a1", 100)], 100);

    expect(plan).toEqual([
      {
        allocationId: "a1",
        paymentDate: "2025-01-15",
        originalAmount: "100.00",
        trimmedTo: "0.00",
      },
    ]);
  });

  it("formats paymentDate as ISO yyyy-mm-dd regardless of time component", () => {
    const plan = computeTrimPlan(
      [alloc("a1", 100, new Date("2025-06-15T18:30:00Z"))],
      30,
    );

    expect(plan[0]!.paymentDate).toBe("2025-06-15");
  });
});
