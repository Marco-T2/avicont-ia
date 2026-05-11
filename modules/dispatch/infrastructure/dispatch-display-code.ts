import type { DispatchType } from "../domain/value-objects/dispatch-type";

/**
 * Generates the display code for a dispatch document.
 * ND = Nota de Despacho, BC = Boleta Cerrada.
 */
export function getDisplayCode(type: DispatchType, seq: number): string {
  const prefix = type === "NOTA_DESPACHO" ? "ND" : "BC";
  return `${prefix}-${String(seq).padStart(3, "0")}`;
}
