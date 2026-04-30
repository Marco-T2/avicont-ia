import { describe, expect, it } from "vitest";
import {
  computePfSummary,
  type ComputedPurchaseDetail,
} from "../compute-pf-summary";

describe("computePfSummary", () => {
  it("returns all zeros when computedDetails is empty", () => {
    expect(computePfSummary([])).toEqual({
      totalGrossKg: 0,
      totalNetKg: 0,
      totalShrinkKg: 0,
      totalShortageKg: 0,
      totalRealNetKg: 0,
    });
  });

  it("sums all 5 weight fields across multiple details", () => {
    const details: ComputedPurchaseDetail[] = [
      {
        grossWeight: 100,
        netWeight: 95,
        shrinkage: 3,
        shortage: 2,
        realNetWeight: 90,
      },
      {
        grossWeight: 50,
        netWeight: 48,
        shrinkage: 1,
        shortage: 1,
        realNetWeight: 46,
      },
    ];

    expect(computePfSummary(details)).toEqual({
      totalGrossKg: 150,
      totalNetKg: 143,
      totalShrinkKg: 4,
      totalShortageKg: 3,
      totalRealNetKg: 136,
    });
  });

  it("treats undefined weight fields as zero", () => {
    const details: ComputedPurchaseDetail[] = [
      { grossWeight: 100, netWeight: 95 },
      { shrinkage: 5, realNetWeight: 90 },
    ];

    expect(computePfSummary(details)).toEqual({
      totalGrossKg: 100,
      totalNetKg: 95,
      totalShrinkKg: 5,
      totalShortageKg: 0,
      totalRealNetKg: 90,
    });
  });

  it("accepts a single detail with all fields set to zero", () => {
    const details: ComputedPurchaseDetail[] = [
      {
        grossWeight: 0,
        netWeight: 0,
        shrinkage: 0,
        shortage: 0,
        realNetWeight: 0,
      },
    ];

    expect(computePfSummary(details)).toEqual({
      totalGrossKg: 0,
      totalNetKg: 0,
      totalShrinkKg: 0,
      totalShortageKg: 0,
      totalRealNetKg: 0,
    });
  });

  it("sums fractional weights without precision loss within reasonable scale", () => {
    const details: ComputedPurchaseDetail[] = [
      { grossWeight: 1.5, netWeight: 1.4, shrinkage: 0.05 },
      { grossWeight: 2.5, netWeight: 2.3, shrinkage: 0.1 },
    ];

    const result = computePfSummary(details);
    expect(result.totalGrossKg).toBe(4);
    expect(result.totalNetKg).toBeCloseTo(3.7, 5);
    expect(result.totalShrinkKg).toBeCloseTo(0.15, 5);
  });
});
