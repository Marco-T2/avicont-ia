/**
 * Calcula el formato legible del número correlativo generado por el sistema
 * para un asiento contable.
 *
 * Formato: {prefix}{YY}{MM}-{000000}
 * Ejemplo: D2604-000015
 *
 * @param prefix - Prefijo del VoucherTypeCfg (ej: "D", "I", "N"). Debe ser un
 *   único carácter. Si viene null/undefined/"" o >1 char, retorna null.
 * @param entryDate - Campo `date` del asiento (NO el período fiscal)
 * @param number - Número correlativo generado por el sistema
 * @returns Cadena formateada, o null si el prefix es inválido
 */
export function formatCorrelativeNumber(
  prefix: string | null | undefined,
  entryDate: Date | string,
  number: number,
): string | null {
  if (!prefix || prefix.length !== 1) return null;

  const date = new Date(entryDate);
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const paddedNumber = String(number).padStart(6, "0");

  return `${prefix}${yy}${mm}-${paddedNumber}`;
}
