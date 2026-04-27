import { describe, it, expect } from "vitest";
import {
  findPeriodCoveringDate,
  type FiscalPeriodLike,
} from "../fiscal-period-finder";

const open = (start: string, end: string): FiscalPeriodLike => ({
  startDate: new Date(start + "T00:00:00.000Z"),
  endDate: new Date(end + "T00:00:00.000Z"),
  status: "OPEN",
});

const closed = (start: string, end: string): FiscalPeriodLike => ({
  startDate: new Date(start + "T00:00:00.000Z"),
  endDate: new Date(end + "T00:00:00.000Z"),
  status: "CLOSED",
});

describe("findPeriodCoveringDate", () => {
  it("returns the OPEN period covering the date", () => {
    const periods = [
      open("2026-01-01", "2026-01-31"),
      open("2026-02-01", "2026-02-28"),
      open("2026-03-01", "2026-03-31"),
    ];
    const found = findPeriodCoveringDate("2026-02-15", periods);
    expect(found).toBe(periods[1]);
  });

  it("includes both bounds (inclusive)", () => {
    const periods = [open("2026-04-01", "2026-04-30")];
    expect(findPeriodCoveringDate("2026-04-01", periods)).toBe(periods[0]);
    expect(findPeriodCoveringDate("2026-04-30", periods)).toBe(periods[0]);
  });

  it("ignores CLOSED periods even when they cover the date", () => {
    const periods = [closed("2026-04-01", "2026-04-30")];
    expect(findPeriodCoveringDate("2026-04-15", periods)).toBeNull();
  });

  it("returns null when no period covers the date", () => {
    const periods = [open("2026-01-01", "2026-01-31")];
    expect(findPeriodCoveringDate("2026-05-15", periods)).toBeNull();
  });

  it("works with string dates (post-JSON wire) for startDate/endDate", () => {
    const period: FiscalPeriodLike = {
      startDate: "2026-04-01T00:00:00.000Z",
      endDate: "2026-04-30T00:00:00.000Z",
      status: "OPEN",
    };
    expect(findPeriodCoveringDate("2026-04-15", [period])).toBe(period);
  });

  it("is TZ-stable: input '2026-04-01' matches a UTC midnight period without shift", () => {
    // This is the bolivian (UTC-4) edge case the original helper guards.
    // Constructing new Date('2026-04-01') would parse as UTC midnight then
    // render as 2026-03-31 in local time. The helper uses string-slice to avoid this.
    const periods = [open("2026-04-01", "2026-04-30")];
    expect(findPeriodCoveringDate("2026-04-01", periods)).toBe(periods[0]);
  });

  it("returns null on empty input", () => {
    expect(findPeriodCoveringDate("2026-04-15", [])).toBeNull();
  });
});
