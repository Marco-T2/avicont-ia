import { describe, it, expect } from "vitest";
import { CalendarMonth } from "../value-objects/calendar-month";
import { InvalidCalendarMonth } from "../errors/fiscal-period-errors";

describe("CalendarMonth.of", () => {
  it("accepts month=1 (January)", () => {
    const cm = CalendarMonth.of(2026, 1);
    expect(cm.year).toBe(2026);
    expect(cm.month).toBe(1);
  });

  it("accepts month=12 (December)", () => {
    const cm = CalendarMonth.of(2026, 12);
    expect(cm.month).toBe(12);
  });

  it("rejects month=0", () => {
    expect(() => CalendarMonth.of(2026, 0)).toThrow(InvalidCalendarMonth);
  });

  it("rejects month=13", () => {
    expect(() => CalendarMonth.of(2026, 13)).toThrow(InvalidCalendarMonth);
  });

  it("rejects non-integer month", () => {
    expect(() => CalendarMonth.of(2026, 1.5)).toThrow(InvalidCalendarMonth);
  });

  it("rejects non-integer year", () => {
    expect(() => CalendarMonth.of(2026.5, 1)).toThrow(InvalidCalendarMonth);
  });
});

describe("CalendarMonth.fromDate", () => {
  it("derives (year, month) from a UTC date", () => {
    const d = new Date(Date.UTC(2026, 3, 15)); // April 15
    const cm = CalendarMonth.fromDate(d);
    expect(cm.year).toBe(2026);
    expect(cm.month).toBe(4);
  });

  it("uses UTC, not local time — first-of-month UTC midnight", () => {
    const d = new Date(Date.UTC(2026, 0, 1));
    const cm = CalendarMonth.fromDate(d);
    expect(cm.year).toBe(2026);
    expect(cm.month).toBe(1);
  });
});

describe("CalendarMonth.equals", () => {
  it("returns true for same year and month", () => {
    expect(CalendarMonth.of(2026, 4).equals(CalendarMonth.of(2026, 4))).toBe(true);
  });

  it("returns false for different month", () => {
    expect(CalendarMonth.of(2026, 4).equals(CalendarMonth.of(2026, 5))).toBe(false);
  });

  it("returns false for different year", () => {
    expect(CalendarMonth.of(2026, 4).equals(CalendarMonth.of(2027, 4))).toBe(false);
  });
});
