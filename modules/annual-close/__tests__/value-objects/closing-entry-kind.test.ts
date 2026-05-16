/**
 * T-04 RED — ClosingEntryKind value object (domain constant enum).
 *
 * Design rev annual-close-canonical-flow #2696 §Domain Value Objects:
 * 5-asientos canonical labels. Pure constant union; no class.
 *
 * Declared failure mode per [[red_acceptance_failure_mode]]:
 *   `Cannot find module '../../domain/value-objects/closing-entry-kind'` —
 *   file does not exist at HEAD a234d61d. T-04 GREEN creates it.
 */

import { describe, expect, it } from "vitest";
import { ClosingEntryKind } from "../../domain/value-objects/closing-entry-kind";

describe("ClosingEntryKind value object (5-asientos canonical labels)", () => {
  it("exports all 5 canonical kinds (#1 GASTOS, #2 INGRESOS, #3 RESULTADO, #4 BALANCE, #5 APERTURA)", () => {
    expect(ClosingEntryKind).toEqual({
      GASTOS: "GASTOS",
      INGRESOS: "INGRESOS",
      RESULTADO: "RESULTADO",
      BALANCE: "BALANCE",
      APERTURA: "APERTURA",
    });
  });

  it("values are stable string literals (greppable for audit / sentinels)", () => {
    const values = Object.values(ClosingEntryKind);
    expect(values).toHaveLength(5);
    for (const v of values) {
      expect(typeof v).toBe("string");
      expect(v.length).toBeGreaterThan(0);
    }
  });
});
