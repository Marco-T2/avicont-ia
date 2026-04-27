import { describe, it, expect } from "vitest";
import { MonthlyRange } from "../value-objects/monthly-range";
import {
  NotMonthly,
  InvalidDateRange,
} from "../errors/fiscal-period-errors";

describe("MonthlyRange.of", () => {
  it("accepts a 31-day month (January)", () => {
    const r = MonthlyRange.of(
      new Date(Date.UTC(2026, 0, 1)),
      new Date(Date.UTC(2026, 0, 31)),
    );
    expect(r.startDate.getUTCDate()).toBe(1);
    expect(r.endDate.getUTCDate()).toBe(31);
  });

  it("accepts a 30-day month (April)", () => {
    const r = MonthlyRange.of(
      new Date(Date.UTC(2026, 3, 1)),
      new Date(Date.UTC(2026, 3, 30)),
    );
    expect(r.calendarMonth.month).toBe(4);
  });

  it("accepts a leap-year February (29 days)", () => {
    const r = MonthlyRange.of(
      new Date(Date.UTC(2024, 1, 1)),
      new Date(Date.UTC(2024, 1, 29)),
    );
    expect(r.endDate.getUTCDate()).toBe(29);
  });

  it("accepts a non-leap February (28 days)", () => {
    const r = MonthlyRange.of(
      new Date(Date.UTC(2025, 1, 1)),
      new Date(Date.UTC(2025, 1, 28)),
    );
    expect(r.endDate.getUTCDate()).toBe(28);
  });

  it("rejects when startDate is not the 1st of the month", () => {
    expect(() =>
      MonthlyRange.of(
        new Date(Date.UTC(2026, 0, 2)),
        new Date(Date.UTC(2026, 0, 31)),
      ),
    ).toThrow(NotMonthly);
  });

  it("rejects when endDate is not the last day of startDate's month", () => {
    expect(() =>
      MonthlyRange.of(
        new Date(Date.UTC(2026, 0, 1)),
        new Date(Date.UTC(2026, 0, 30)),
      ),
    ).toThrow(NotMonthly);
  });

  it("rejects cross-month range", () => {
    expect(() =>
      MonthlyRange.of(
        new Date(Date.UTC(2026, 0, 1)),
        new Date(Date.UTC(2026, 1, 28)),
      ),
    ).toThrow(NotMonthly);
  });

  it("rejects endDate <= startDate", () => {
    expect(() =>
      MonthlyRange.of(
        new Date(Date.UTC(2026, 0, 31)),
        new Date(Date.UTC(2026, 0, 1)),
      ),
    ).toThrow(InvalidDateRange);
  });

  it("rejects endDate equal to startDate", () => {
    expect(() =>
      MonthlyRange.of(
        new Date(Date.UTC(2026, 0, 1)),
        new Date(Date.UTC(2026, 0, 1)),
      ),
    ).toThrow(InvalidDateRange);
  });

  it("rejects 29-Feb in non-leap year (rolls to March 1, fails monthly check)", () => {
    expect(() =>
      MonthlyRange.of(
        new Date(Date.UTC(2025, 1, 1)),
        new Date(Date.UTC(2025, 2, 1)), // March 1 — will fail monthly
      ),
    ).toThrow(NotMonthly);
  });
});

describe("MonthlyRange.calendarMonth", () => {
  it("derives the calendar month from startDate UTC", () => {
    const r = MonthlyRange.of(
      new Date(Date.UTC(2026, 5, 1)),
      new Date(Date.UTC(2026, 5, 30)),
    );
    expect(r.calendarMonth.year).toBe(2026);
    expect(r.calendarMonth.month).toBe(6);
  });
});

describe("MonthlyRange.contains", () => {
  const range = MonthlyRange.of(
    new Date(Date.UTC(2026, 3, 1)),
    new Date(Date.UTC(2026, 3, 30)),
  );

  it("includes the first day", () => {
    expect(range.contains("2026-04-01")).toBe(true);
  });

  it("includes the last day", () => {
    expect(range.contains("2026-04-30")).toBe(true);
  });

  it("includes a middle day", () => {
    expect(range.contains("2026-04-15")).toBe(true);
  });

  it("excludes the day before the range", () => {
    expect(range.contains("2026-03-31")).toBe(false);
  });

  it("excludes the day after the range", () => {
    expect(range.contains("2026-05-01")).toBe(false);
  });

  it("accepts a Date input and is TZ-stable (string slice)", () => {
    expect(range.contains(new Date(Date.UTC(2026, 3, 15)))).toBe(true);
  });
});
