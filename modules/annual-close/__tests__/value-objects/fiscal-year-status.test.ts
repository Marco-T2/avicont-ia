/**
 * Phase 2.3 RED — FiscalYearStatus VO shape.
 *
 * Design rev 2 §3: mirrors `FiscalPeriodStatus` EXACT — `OPEN | CLOSED`
 * literal value, `.open()` / `.closed()` factories, `.isOpen()` / `.isClosed()`
 * predicates, `.value` getter, equality.
 *
 * Declared failure mode per [[red_acceptance_failure_mode]]:
 *   Module `../../domain/value-objects/fiscal-year-status` does not exist
 *   at HEAD 81f9bbec. Vitest reports a module-resolution failure; no
 *   `it()` block executes. Phase 2.4 GREEN creates the file.
 */

import { describe, expect, it } from "vitest";
import { FiscalYearStatus } from "../../domain/value-objects/fiscal-year-status";

describe("FiscalYearStatus value-object", () => {
  describe("factories", () => {
    it("FiscalYearStatus.open() returns OPEN", () => {
      expect(FiscalYearStatus.open().value).toBe("OPEN");
    });

    it("FiscalYearStatus.closed() returns CLOSED", () => {
      expect(FiscalYearStatus.closed().value).toBe("CLOSED");
    });
  });

  describe("FiscalYearStatus.of", () => {
    it("parses 'OPEN' literal", () => {
      expect(FiscalYearStatus.of("OPEN").value).toBe("OPEN");
    });

    it("parses 'CLOSED' literal", () => {
      expect(FiscalYearStatus.of("CLOSED").value).toBe("CLOSED");
    });

    it("throws on an unknown literal", () => {
      expect(() => FiscalYearStatus.of("UNKNOWN")).toThrow();
    });
  });

  describe("predicates", () => {
    it("open().isOpen() is true and isClosed() is false", () => {
      const s = FiscalYearStatus.open();
      expect(s.isOpen()).toBe(true);
      expect(s.isClosed()).toBe(false);
    });

    it("closed().isClosed() is true and isOpen() is false", () => {
      const s = FiscalYearStatus.closed();
      expect(s.isClosed()).toBe(true);
      expect(s.isOpen()).toBe(false);
    });
  });

  describe("equals", () => {
    it("returns true for two same-valued instances", () => {
      expect(FiscalYearStatus.open().equals(FiscalYearStatus.open())).toBe(true);
    });

    it("returns false for different values", () => {
      expect(FiscalYearStatus.open().equals(FiscalYearStatus.closed())).toBe(false);
    });
  });
});
