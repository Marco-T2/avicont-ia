// ── Shared PDF formatting helpers ─────────────────────────────────────────────
//
// Provides the canonical fmtDecimal() used by all accounting PDF exporters.
// Co-located with pdf.fonts.ts in features/accounting/financial-statements/exporters/.

export interface DecimalLike {
  isZero(): boolean;
  isNegative(): boolean;
  abs(): { toNumber(): number };
  toNumber(): number;
}

/**
 * Formats a Decimal-like value for display in es-BO locale.
 *
 * Zero convention:
 *   - isTotal=false (detail rows): zero → ""
 *   - isTotal=true  (total rows):  zero → "0,00"
 *
 * Negative: absolute value wrapped in parentheses, e.g. "(1.234,56)"
 * Positive: formatted with es-BO thousands (.) and decimal (,), e.g. "1.234,56"
 */
export function fmtDecimal(value: DecimalLike, isTotal: boolean): string {
  if (value.isZero()) {
    return isTotal
      ? (0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "";
  }
  if (value.isNegative()) {
    const abs = value.abs().toNumber().toLocaleString("es-BO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `(${abs})`;
  }
  return value.toNumber().toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
