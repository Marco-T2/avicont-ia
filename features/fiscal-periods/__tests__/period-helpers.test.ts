/**
 * Unit tests for findPeriodCoveringDate helper.
 *
 * RED phase — T-1.a
 * Covers 5 cases per tasks.md:
 *   Case 1: date inside range → returns matching OPEN period
 *   Case 2: date = startDate (inclusive boundary) → matches
 *   Case 3: date = endDate   (inclusive boundary) → matches
 *   Case 4: no OPEN period covers date → returns null
 *   Case 5: period covers date but status ≠ OPEN → returns null (non-OPEN ignored)
 *
 * Date comparison uses YYYY-MM-DD string slice (UTC ISO) to avoid Bolivia UTC-4 shift.
 */

import { describe, expect, it } from "vitest";
import { findPeriodCoveringDate } from "../period-helpers";
import type { FiscalPeriod } from "@/generated/prisma/client";

// ── Helpers ──

function makePeriod(overrides: Partial<FiscalPeriod>): FiscalPeriod {
  return {
    id: "period-1",
    name: "Abril 2026",
    startDate: new Date("2026-04-01T00:00:00.000Z"),
    endDate: new Date("2026-04-30T00:00:00.000Z"),
    status: "OPEN",
    organizationId: "org-1",
    year: 2026,
    createdById: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as FiscalPeriod;
}

const OPEN_APRIL = makePeriod({});

// ── Tests ──

describe("findPeriodCoveringDate", () => {
  it("Case 1: date inside range → returns the matching OPEN period", () => {
    const result = findPeriodCoveringDate("2026-04-15", [OPEN_APRIL]);
    expect(result).not.toBeNull();
    expect(result?.id).toBe("period-1");
  });

  it("Case 2: date equals startDate (inclusive lower bound) → matches", () => {
    const result = findPeriodCoveringDate("2026-04-01", [OPEN_APRIL]);
    expect(result).not.toBeNull();
    expect(result?.id).toBe("period-1");
  });

  it("Case 3: date equals endDate (inclusive upper bound) → matches", () => {
    const result = findPeriodCoveringDate("2026-04-30", [OPEN_APRIL]);
    expect(result).not.toBeNull();
    expect(result?.id).toBe("period-1");
  });

  it("Case 4: no OPEN period covers date → returns null", () => {
    const result = findPeriodCoveringDate("2026-05-15", [OPEN_APRIL]);
    expect(result).toBeNull();
  });

  it("Case 5: period covers date but status ≠ OPEN → returns null (non-OPEN ignored)", () => {
    const closedApril = makePeriod({ status: "CLOSED" });
    const result = findPeriodCoveringDate("2026-04-15", [closedApril]);
    expect(result).toBeNull();
  });
});
