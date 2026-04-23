/**
 * Aplica el redondeo cooperativo al total final del despacho.
 * Algoritmo:
 * 1. Trunca a un decimal
 * 2. Extrae el primer dígito decimal
 * 3. Si el dígito >= (threshold * 10) → redondea hacia arriba, si no hacia abajo
 *
 * @param exactSum - Suma cruda de todos los lineAmounts (sin redondear)
 * @param threshold - Desde OrgSettings.roundingThreshold (ej.: 0.7)
 * @returns Monto total entero para CxC
 */
export function roundTotal(exactSum: number, threshold: number): number {
  const truncated = Math.floor(exactSum * 10) / 10;
  const firstDecimal = Math.round((truncated % 1) * 10);
  if (firstDecimal >= threshold * 10) {
    return Math.ceil(truncated);
  }
  return Math.floor(truncated);
}

