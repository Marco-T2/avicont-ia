/**
 * Applies cooperative rounding to the final dispatch total.
 * Algorithm:
 * 1. Truncate to one decimal
 * 2. Extract the first decimal digit
 * 3. If digit >= (threshold * 10) → round up, otherwise round down
 *
 * @param exactSum - Raw sum of all lineAmounts (unrounded)
 * @param threshold - From OrgSettings.roundingThreshold (e.g. 0.7)
 * @returns Integer total amount for receivables
 */
export function roundTotal(exactSum: number, threshold: number): number {
  const truncated = Math.floor(exactSum * 10) / 10;
  const firstDecimal = Math.round((truncated % 1) * 10);
  if (firstDecimal >= threshold * 10) {
    return Math.ceil(truncated);
  }
  return Math.floor(truncated);
}
