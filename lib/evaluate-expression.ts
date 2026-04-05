/**
 * Evaluates a simple arithmetic expression safely.
 * Whitelist: digits, dots, +, -, *, /, spaces only.
 * Returns the numeric result rounded to 2 decimals, or null if invalid/NaN/Infinity.
 */
const SAFE_EXPR = /^[0-9.+\-*/\s]+$/;

export function evaluateExpression(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!SAFE_EXPR.test(trimmed)) return null;

  try {
    // eslint-disable-next-line no-eval
    const result = eval(trimmed) as unknown;
    if (typeof result !== "number" || !isFinite(result)) return null;
    return Math.round(result * 100) / 100;
  } catch {
    return null;
  }
}
