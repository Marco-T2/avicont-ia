/**
 * Función pura para generar el siguiente código de cuenta.
 * Utilizada tanto por el servicio (servidor) como por la UI (cliente) para previsualizar el código.
 *
 * @param parentCode - El código de la cuenta padre, o null para cuentas raíz
 * @param siblingCodes - Códigos de todas las cuentas al mismo nivel bajo el mismo padre
 * @returns El siguiente código secuencial (ej. "1.1.4" si los hermanos son ["1.1.1", "1.1.2", "1.1.3"])
 */
export function getNextCode(
  parentCode: string | null,
  siblingCodes: string[],
): string {
  if (!parentCode) {
    // Nivel raíz: parsear todos los códigos como enteros y encontrar el máximo
    const maxNum = siblingCodes.reduce((max, code) => {
      const num = parseInt(code, 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 0);
    return String(maxNum + 1);
  }

  // Nivel hijo: extraer el último segmento de cada hermano y encontrar el máximo
  const prefix = parentCode + ".";
  const maxNum = siblingCodes
    .filter((c) => c.startsWith(prefix))
    .reduce((max, code) => {
      const lastSegment = code.slice(prefix.length).split(".")[0];
      const num = parseInt(lastSegment, 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 0);

  return `${parentCode}.${maxNum + 1}`;
}
