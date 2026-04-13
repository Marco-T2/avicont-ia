import type { DispatchType } from "@/generated/prisma/client";

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

interface DescriptionLine {
  code?: string;
  detailNote?: string;
  netWeight: number;
  realNetWeight?: number;
  unitPrice: number;
}

/**
 * Builds auto-generated dispatch header description from detail lines.
 * Format without note: "{code} {weight}kg ({unitPrice})"
 * Format with note:    "{code}-{detailNote} {weight}kg ({unitPrice})"
 * Lines joined by " | ". Incomplete lines (no code or weight=0) are omitted.
 * Weight: netWeight for ND, realNetWeight for BC (1 decimal).
 */
export function buildDispatchDescription(
  lines: DescriptionLine[],
  dispatchType: DispatchType,
): string {
  return lines
    .filter((l) => l.code && l.netWeight > 0)
    .map((l) => {
      const weight =
        dispatchType === "BOLETA_CERRADA"
          ? (l.realNetWeight ?? l.netWeight)
          : l.netWeight;
      const prefix = l.detailNote
        ? `${l.code}-${l.detailNote}`
        : l.code;
      return `${prefix} ${weight.toFixed(1)}kg (${l.unitPrice})`;
    })
    .join(" | ");
}
