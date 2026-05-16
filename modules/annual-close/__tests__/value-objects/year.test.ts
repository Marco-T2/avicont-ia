/**
 * Phase 2.1 RED — Year value-object shape + range validation.
 *
 * Spec REQ-2.1 (annual-close): `year ∈ [1900, 2100]` — out-of-range throws
 * `InvalidYearError`. Design rev 2 §3: pure int VO, `.next()` increments,
 * `.value` getter returns int.
 *
 * Declared failure mode per [[red_acceptance_failure_mode]]:
 *   Module `../../domain/value-objects/year` does NOT exist yet at HEAD
 *   85827110. Vitest reports a module-resolution failure for the import;
 *   subsequent `it()` blocks never execute. GREEN in 2.2 creates the file
 *   and turns the resolution + all assertions green together.
 */

import { describe, expect, it } from "vitest";
import { Year } from "../../domain/value-objects/year";
import { InvalidYearError } from "../../domain/errors/annual-close-errors";

describe("Year value-object", () => {
  describe("Year.of (range validation)", () => {
    it("accepts the lower bound 1900", () => {
      expect(Year.of(1900).value).toBe(1900);
    });

    it("accepts the upper bound 2100", () => {
      expect(Year.of(2100).value).toBe(2100);
    });

    it("accepts a typical mid-range year", () => {
      expect(Year.of(2026).value).toBe(2026);
    });

    it("throws InvalidYearError for 1899 (below lower bound)", () => {
      expect(() => Year.of(1899)).toThrow(InvalidYearError);
    });

    it("throws InvalidYearError for 2101 (above upper bound)", () => {
      expect(() => Year.of(2101)).toThrow(InvalidYearError);
    });

    it("throws InvalidYearError for a non-integer", () => {
      expect(() => Year.of(2025.5)).toThrow(InvalidYearError);
    });

    it("throws InvalidYearError for NaN", () => {
      expect(() => Year.of(NaN)).toThrow(InvalidYearError);
    });

    it("InvalidYearError carries the offending value in details", () => {
      try {
        Year.of(1500);
        expect.fail("Year.of(1500) should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(InvalidYearError);
        expect((e as InvalidYearError).details).toMatchObject({ value: 1500 });
      }
    });
  });

  describe("Year.next", () => {
    it("returns a new Year whose value is +1", () => {
      const y = Year.of(2026);
      expect(y.next().value).toBe(2027);
    });

    it("throws InvalidYearError when .next() crosses the upper bound", () => {
      const y = Year.of(2100);
      expect(() => y.next()).toThrow(InvalidYearError);
    });
  });

  describe("Year.equals", () => {
    it("returns true for two Year instances with the same value", () => {
      expect(Year.of(2026).equals(Year.of(2026))).toBe(true);
    });

    it("returns false for two Year instances with different values", () => {
      expect(Year.of(2026).equals(Year.of(2027))).toBe(false);
    });
  });

  describe("Year.toString", () => {
    it("renders the year as a 4-digit decimal string", () => {
      expect(Year.of(2026).toString()).toBe("2026");
    });
  });
});
