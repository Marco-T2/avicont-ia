import type { DispatchType } from "@/generated/prisma/client";

/**
 * Applies cooperative rounding to the final dispatch total.
 * Algorithm:
 * 1. Truncate to one decimal place
 * 2. Extract first decimal digit
 * 3. If digit >= (threshold * 10) → ceil to integer, else floor
 *
 * @param exactSum - Raw sum of all lineAmounts (unrounded)
 * @param threshold - From OrgSettings.roundingThreshold (e.g., 0.7)
 * @returns Integer total amount for CxC
 */
export function roundTotal(exactSum: number, threshold: number): number {
  const truncated = Math.floor(exactSum * 10) / 10;
  const firstDecimal = Math.round((truncated % 1) * 10);
  if (firstDecimal >= threshold * 10) {
    return Math.ceil(truncated);
  }
  return Math.floor(truncated);
}

interface DescriptionLine {
  code?: string;
  detailNote?: string;
  netWeight: number;
  realNetWeight?: number;
  unitPrice: number;
}

/**
 * Builds auto-generated dispatch header description from detail lines.
 * Format without note: "{code} {weight}kg ({unitPrice})"
 * Format with note:    "{code}-{detailNote} {weight}kg ({unitPrice})"
 * Lines joined by " | ". Incomplete lines (no code or weight=0) are omitted.
 * Weight: netWeight for ND, realNetWeight for BC (1 decimal).
 */
export function buildDispatchDescription(
  lines: DescriptionLine[],
  dispatchType: DispatchType,
): string {
  return lines
    .filter((l) => l.code && l.netWeight > 0)
    .map((l) => {
      const weight =
        dispatchType === "BOLETA_CERRADA"
          ? (l.realNetWeight ?? l.netWeight)
          : l.netWeight;
      const prefix = l.detailNote
        ? `${l.code}-${l.detailNote}`
        : l.code;
      return `${prefix} ${weight.toFixed(1)}kg (${l.unitPrice})`;
    })
    .join(" | ");
}
