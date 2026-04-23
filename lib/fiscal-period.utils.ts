/**
 * Utilidades para período fiscal — lógica de gate de UI.
 *
 * D5 (iva-journal-integration): el período debe ser OPEN para habilitar
 * acciones sobre el Libro IVA. El servicio re-verifica el estado dentro
 * de la transacción (carrera de periodo cerrado), pero la UI gate es
 * la primera línea de defensa (UX).
 */

/**
 * Retorna `true` si el período fiscal está abierto (OPEN).
 * Defensivo: `null` / `undefined` se trata como cerrado.
 */
export function isFiscalPeriodOpen(
  period?: { status: string } | null,
): boolean {
  return period?.status === "OPEN";
}
export const FISCAL_PERIOD_CLOSED_MESSAGE = "El período fiscal está cerrado.";
