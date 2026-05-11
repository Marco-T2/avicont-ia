import type { ComputedDetail } from "./compute-line-amounts";

/**
 * BC header summary fields — aggregated from computed detail lines.
 * Pure domain type — no Prisma Decimal.
 */
export interface BcSummary {
  totalGrossKg: number;
  totalNetKg: number;
  totalShrinkKg: number;
  totalShortageKg: number;
  totalRealNetKg: number;
  avgKgPerChicken: number;
}

/**
 * Pure domain function: computes BC header summary from computed details.
 */
export function computeBcSummary(
  computedDetails: ComputedDetail[],
  chickenCount: number,
): BcSummary {
  const totalGrossKg = computedDetails.reduce((s, d) => s + d.grossWeight, 0);
  const totalNetKg = computedDetails.reduce((s, d) => s + d.netWeight, 0);
  const totalShrinkKg = computedDetails.reduce(
    (s, d) => s + (d.shrinkage ?? 0),
    0,
  );
  const totalShortageKg = computedDetails.reduce(
    (s, d) => s + (d.shortage ?? 0),
    0,
  );
  const totalRealNetKg = computedDetails.reduce(
    (s, d) => s + (d.realNetWeight ?? 0),
    0,
  );
  const avgKgPerChicken = chickenCount > 0 ? totalNetKg / chickenCount : 0;
  return {
    totalGrossKg,
    totalNetKg,
    totalShrinkKg,
    totalShortageKg,
    totalRealNetKg,
    avgKgPerChicken,
  };
}
