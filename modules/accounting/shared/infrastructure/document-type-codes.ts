import "server-only";
import type { DispatchType, PurchaseType } from "@/generated/prisma/client";

/**
 * Mapeo del enum `DispatchType` al código operacional físico que la UI del
 * libro mayor por contacto muestra en la columna "Tipo".
 *
 * El código es lo que el cobrador necesita leer para identificar qué
 * documento físico ir a buscar (ND = Nota de Despacho, BC = Boleta Cerrada).
 */
export function dispatchTypeToCode(t: DispatchType): string {
  switch (t) {
    case "NOTA_DESPACHO":
      return "ND";
    case "BOLETA_CERRADA":
      return "BC";
  }
}

/**
 * Mapeo del enum `PurchaseType` al código operacional físico.
 *
 * FL = Flete, PF = Pollo Faenado, CG = Compra General, SV = Servicio.
 */
export function purchaseTypeToCode(t: PurchaseType): string {
  switch (t) {
    case "FLETE":
      return "FL";
    case "POLLO_FAENADO":
      return "PF";
    case "COMPRA_GENERAL":
      return "CG";
    case "SERVICIO":
      return "SV";
  }
}

/**
 * Código operacional físico fijo para Ventas. Sale NO tiene
 * `operationalDocType` configurable a diferencia de Payment — siempre se
 * surfacea como "VG" (Venta General).
 */
export const SALE_DOCUMENT_TYPE_CODE = "VG";

/**
 * Devuelve el número físico raw del documento para la columna "Nro" del libro
 * mayor por contacto — solo el sequence sin prefijo ni padding (ej "1", "42",
 * "5"). El código operacional físico (VG/RC/ND/etc.) ya se surfacea en la
 * columna "Tipo" vía `documentTypeCode`, así que el prefijo aquí era ruido
 * visual (QA Marco). DT4 — paridad con journal/sales/purchases.
 *
 * Devuelve null cuando NO hay sequence — la UI cae al `displayNumber`
 * correlative voucher contable. El parámetro `code` se mantiene en la firma
 * por compatibilidad de callers (y para futura reintroducción opcional), pero
 * ya no participa en el output.
 */
export function formatDocumentReferenceNumber(
  code: string | null,
  sequence: number | null,
): string | null {
  if (code === null || sequence === null) return null;
  return String(sequence);
}
