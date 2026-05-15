import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { roundHalfUp } from "@/modules/accounting/shared/domain/money.utils";

/**
 * Unit sentinel for the C0 helper extension of the canonical shared
 * money utilities — `roundHalfUp(d: Decimal): Decimal`.
 *
 * Design lock D1+D3 of poc-money-math-decimal-convergence:
 *   roundHalfUp = d.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP) — mode 4
 *   (HALF_UP = round half AWAY from zero).
 *
 * Drift declaration (design D3, parity matrix):
 *   Negative-half case (-2.675 → -2.68) diverges from JS Math.round, which
 *   rounds -2.675 → -2.67 (round toward +∞ on exact .5). Decimal mode 4 is
 *   half-AWAY-from-zero, so -2.675 → -2.68. Acceptable for TIER 1 (ledger
 *   inputs non-negative per DB CHECK; running balance subtraction never on
 *   exact .x5). Parity matrix covers boundary in money-decimal-parity.test.ts.
 */
describe("roundHalfUp (shared/domain/money.utils)", () => {
  it("rounds positive .x5 half-up (2.675 → 2.68)", () => {
    const result = roundHalfUp(new Prisma.Decimal("2.675"));
    expect(result.toFixed(2)).toBe("2.68");
  });

  it("rounds negative .x5 half-AWAY-from-zero (-2.675 → -2.68) — drift declared", () => {
    const result = roundHalfUp(new Prisma.Decimal("-2.675"));
    expect(result.toFixed(2)).toBe("-2.68");
  });

  it("preserves exact 2-place value (75.5 → 75.50 string)", () => {
    const result = roundHalfUp(new Prisma.Decimal("75.5"));
    expect(result.toFixed(2)).toBe("75.50");
  });
});
