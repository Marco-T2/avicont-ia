/**
 * Tests para lib/date-utils.ts (PR1 — RED → GREEN)
 *
 * Cubre REQ-A.1, REQ-A.2, REQ-A.3 del change fix-comprobante-date-tz.
 *
 * NOTA: Este test file corre en el proyecto "node" de vitest (entorno Node.js,
 * sin DOM). La TZ del proceso está fijada a "America/La_Paz" (UTC-4) en
 * vitest.config.ts — esto es lo que hace que los getters locales devuelvan
 * la fecha correcta al correr los casos de regresión.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import { todayLocal, formatDateBO, toNoonUtc, lastDayOfUTCMonth, addUTCDays } from "@/lib/date-utils";

// ── todayLocal() ──────────────────────────────────────────────────────────────

describe("todayLocal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("(a) returns local date at 15:00 Bolivia (safe window)", () => {
    // 15:00 BO = 19:00 UTC (UTC-4), same day everywhere
    vi.setSystemTime(new Date("2026-04-17T15:00:00-04:00"));
    expect(todayLocal()).toBe("2026-04-17");
  });

  it("(b) regression: 23:00 BO on Apr 17 = 03:00 UTC Apr 18 → still Apr 17", () => {
    // Este es el caso reportado: UTC dice mañana, local dice hoy
    vi.setSystemTime(new Date("2026-04-17T23:00:00-04:00"));
    expect(todayLocal()).toBe("2026-04-17");
  });

  it("(c) 00:30 BO on Apr 18 → correctly returns Apr 18", () => {
    vi.setSystemTime(new Date("2026-04-18T00:30:00-04:00"));
    expect(todayLocal()).toBe("2026-04-18");
  });

  it("(d) Dec 31 23:59 BO → year does NOT roll to next year", () => {
    vi.setSystemTime(new Date("2026-12-31T23:59:00-04:00"));
    expect(todayLocal()).toBe("2026-12-31");
  });

  it("(e) single-digit month/day are zero-padded", () => {
    vi.setSystemTime(new Date("2026-01-05T10:00:00-04:00"));
    expect(todayLocal()).toBe("2026-01-05");
  });
});

// ── formatDateBO() ────────────────────────────────────────────────────────────

describe("formatDateBO", () => {
  it("(a) bare YYYY-MM-DD string → DD/MM/YYYY", () => {
    expect(formatDateBO("2026-04-17")).toBe("17/04/2026");
  });

  it("(b) full ISO UTC-midnight string → DD/MM/YYYY (the bug fix guarantee)", () => {
    // Old rows stored at midnight UTC — must NOT shift back one day
    expect(formatDateBO("2026-04-17T00:00:00.000Z")).toBe("17/04/2026");
  });

  it("(c) full ISO UTC-noon string → DD/MM/YYYY", () => {
    expect(formatDateBO("2026-04-17T12:00:00.000Z")).toBe("17/04/2026");
  });

  it("(d) Date instance (UTC-midnight) → DD/MM/YYYY", () => {
    expect(formatDateBO(new Date("2026-04-17T00:00:00.000Z"))).toBe("17/04/2026");
  });

  it("(d2) Date instance (UTC-noon) → DD/MM/YYYY", () => {
    expect(formatDateBO(new Date("2026-04-17T12:00:00.000Z"))).toBe("17/04/2026");
  });

  it("(e) single-digit day and month are zero-padded", () => {
    expect(formatDateBO("2026-01-05")).toBe("05/01/2026");
  });

  // Edge cases — REQ-A.3

  it("(f) null → empty string", () => {
    expect(formatDateBO(null)).toBe("");
  });

  it("(f) undefined → empty string", () => {
    expect(formatDateBO(undefined)).toBe("");
  });

  it("(f) empty string → empty string", () => {
    expect(formatDateBO("")).toBe("");
  });

  it("(f) string shorter than 10 chars → empty string", () => {
    expect(formatDateBO("2026-04")).toBe("");
  });

  it("(f) non-ISO string 'not-a-date' → empty string", () => {
    expect(formatDateBO("not-a-date")).toBe("");
  });

  it("(f) invalid Date instance → empty string", () => {
    expect(formatDateBO(new Date("invalid"))).toBe("");
  });
});

// ── toNoonUtc() ───────────────────────────────────────────────────────────────

describe("toNoonUtc", () => {
  it("(a) bare YYYY-MM-DD → Date at noon UTC", () => {
    const result = toNoonUtc("2026-04-17");
    expect(result.toISOString()).toBe("2026-04-17T12:00:00.000Z");
  });

  it("(b) full ISO UTC-midnight → same noon UTC (slice(0,10) avoids double-append)", () => {
    const result = toNoonUtc("2026-04-17T00:00:00.000Z");
    expect(result.toISOString()).toBe("2026-04-17T12:00:00.000Z");
  });

  it("(c) full ISO with non-midnight time → same noon UTC", () => {
    const result = toNoonUtc("2026-04-17T08:30:00.000Z");
    expect(result.toISOString()).toBe("2026-04-17T12:00:00.000Z");
  });

  it("(d) Date instance (from z.coerce.date boundary) → same noon UTC", () => {
    // Dispatch uses z.coerce.date() so repo receives a Date, not a string
    const result = toNoonUtc(new Date("2026-04-17T00:00:00.000Z"));
    expect(result.toISOString()).toBe("2026-04-17T12:00:00.000Z");
  });

  it("(e) empty string → throws RangeError", () => {
    expect(() => toNoonUtc("")).toThrow(RangeError);
  });

  it("(f) garbage string → throws RangeError", () => {
    expect(() => toNoonUtc("abcd")).toThrow(RangeError);
  });
});

// ── lastDayOfUTCMonth() ───────────────────────────────────────────────────────

describe("lastDayOfUTCMonth", () => {
  it("(a) January 2026 → January 31", () => {
    const result = lastDayOfUTCMonth(new Date(Date.UTC(2026, 0, 1)));
    expect(result.toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });

  it("(b) February 2024 (leap year) → February 29", () => {
    const result = lastDayOfUTCMonth(new Date(Date.UTC(2024, 1, 1)));
    expect(result.toISOString()).toBe("2024-02-29T00:00:00.000Z");
  });

  it("(c) February 2026 (non-leap year) → February 28", () => {
    const result = lastDayOfUTCMonth(new Date(Date.UTC(2026, 1, 1)));
    expect(result.toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });

  it("(d) April 2026 (30-day month) → April 30", () => {
    const result = lastDayOfUTCMonth(new Date(Date.UTC(2026, 3, 1)));
    expect(result.toISOString()).toBe("2026-04-30T00:00:00.000Z");
  });

  it("(e) December 2026 (year rollover) → December 31", () => {
    // Date.UTC(2026, 12, 0) wraps: month 12 = Jan 2027, day 0 = last day of Dec 2026
    const result = lastDayOfUTCMonth(new Date(Date.UTC(2026, 11, 1)));
    expect(result.toISOString()).toBe("2026-12-31T00:00:00.000Z");
  });
});

// ── addUTCDays() ──────────────────────────────────────────────────────────────

describe("addUTCDays", () => {
  it("(a) delta=-1 returns previous UTC day preserving time-of-day", () => {
    const result = addUTCDays(new Date("2026-04-17T12:00:00.000Z"), -1);
    expect(result.toISOString()).toBe("2026-04-16T12:00:00.000Z");
  });

  it("(b) delta=+1 advances one UTC day", () => {
    const result = addUTCDays(new Date("2026-04-17T00:00:00.000Z"), 1);
    expect(result.toISOString()).toBe("2026-04-18T00:00:00.000Z");
  });

  it("(c) delta crosses month boundary (Mar 1 - 1 = Feb 28 in 2026 non-leap)", () => {
    const result = addUTCDays(new Date("2026-03-01T00:00:00.000Z"), -1);
    expect(result.toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });

  it("(d) delta crosses year boundary (Jan 1 - 1 = Dec 31 prior year)", () => {
    const result = addUTCDays(new Date("2026-01-01T00:00:00.000Z"), -1);
    expect(result.toISOString()).toBe("2025-12-31T00:00:00.000Z");
  });

  it("(e) delta=0 returns a clone (same instant, different reference)", () => {
    const src = new Date("2026-04-17T12:00:00.000Z");
    const result = addUTCDays(src, 0);
    expect(result.toISOString()).toBe(src.toISOString());
    expect(result).not.toBe(src);
  });

  it("(f) does not mutate the source date", () => {
    const src = new Date("2026-04-17T00:00:00.000Z");
    const iso = src.toISOString();
    addUTCDays(src, -5);
    expect(src.toISOString()).toBe(iso);
  });
});
