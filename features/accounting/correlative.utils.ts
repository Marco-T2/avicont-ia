const TYPE_PREFIX_MAP: Record<string, string> = {
  CI: "I",
  CE: "E",
  CD: "D",
  CT: "T",
  CA: "A",
};

/**
 * Computes the human-readable display format for a journal entry's
 * system-generated correlative number.
 *
 * Format: {typePrefix}{YY}{MM}-{000000}
 * Example: D2604-000015
 *
 * @param voucherTypeCode - The voucher type code (CI, CE, CD, CT, CA)
 * @param entryDate - The journal entry's `date` field (NOT the fiscal period)
 * @param number - The system-generated correlative number
 * @returns The formatted display string, or null if the type code is unknown
 */
export function formatCorrelativeNumber(
  voucherTypeCode: string,
  entryDate: Date | string,
  number: number,
): string | null {
  const prefix = TYPE_PREFIX_MAP[voucherTypeCode];
  if (!prefix) return null;

  const date = new Date(entryDate);
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const paddedNumber = String(number).padStart(6, "0");

  return `${prefix}${yy}${mm}-${paddedNumber}`;
}
