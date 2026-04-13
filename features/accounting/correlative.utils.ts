const TYPE_PREFIX_MAP: Record<string, string> = {
  CI: "I",
  CE: "E",
  CD: "D",
  CT: "T",
  CA: "A",
};

/**
 * Calcula el formato legible del número correlativo generado por el sistema
 * para un asiento contable.
 *
 * Formato: {typePrefix}{YY}{MM}-{000000}
 * Ejemplo: D2604-000015
 *
 * @param voucherTypeCode - Código del tipo de comprobante (CI, CE, CD, CT, CA)
 * @param entryDate - Campo `date` del asiento (NO el período fiscal)
 * @param number - Número correlativo generado por el sistema
 * @returns Cadena formateada, o null si el código de tipo es desconocido
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
