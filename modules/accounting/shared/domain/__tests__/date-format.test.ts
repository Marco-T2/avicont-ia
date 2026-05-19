/**
 * T-11 RED — glosa-enriquecida-ventas-cobros Phase 2.
 *
 * Shared formatter `formatDateConditional(date, refYear)`:
 *   - Same year as refYear  → "DD/MM"
 *   - Different year         → "DD/MM/YY"  (2-digit year)
 *
 * Acceptance scenarios from spec REQ-GE-6 + design D6.
 *
 * Expected FAIL (RED): function not yet exported from `date-format.ts`.
 */
import { describe, it, expect } from "vitest";
import { formatDateConditional } from "../date-format";

describe("formatDateConditional (REQ-GE-6)", () => {
  describe.each([
    // [label, date, refYear, expected]
    ["6.1 same year — basic", new Date(2026, 4, 17), 2026, "17/05"],
    ["6.2 different year — past", new Date(2025, 11, 29), 2026, "29/12/25"],
    ["6.3 same-year boundary Dec 31", new Date(2026, 11, 31), 2026, "31/12"],
    ["6.4 different-year boundary Jan 1", new Date(2024, 0, 1), 2026, "01/01/24"],
    ["zero-pad day < 10", new Date(2026, 0, 5), 2026, "05/01"],
    ["zero-pad month < 10", new Date(2026, 2, 17), 2026, "17/03"],
  ])("%s", (_label, date, refYear, expected) => {
    it(`formats correctly`, () => {
      expect(formatDateConditional(date as Date, refYear as number)).toBe(
        expected,
      );
    });
  });
});
