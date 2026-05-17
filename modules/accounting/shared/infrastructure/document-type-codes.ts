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
 * Formatea el número físico del documento para la columna "Nº" del libro
 * mayor por contacto: `"${code}-${seq padded(4)}"` (ej "VG-0001", "RC-0042",
 * "ND-0005"). DT4 — QA Marco.
 *
 * Devuelve null cuando NO se puede armar el string — el adapter pasa por aquí
 * con (code, seq) y la decisión de fallback la toma la UI (cae a
 * `displayNumber` correlative voucher contable):
 *  - code es null (asiento manual sin auxiliar o Payment sin operationalDocType).
 *  - seq es null (Payment sin referenceNumber capturado por el operador).
 *
 * Padding fijo en 4 dígitos: paridad con el typing real de los modelos
 * (Sale/Dispatch/Purchase.sequenceNumber + Payment.referenceNumber son
 * `Int`, comparten orden de magnitud).
 */
export function formatDocumentReferenceNumber(
  code: string | null,
  sequence: number | null,
): string | null {
  if (code === null || sequence === null) return null;
  return `${code}-${String(sequence).padStart(4, "0")}`;
}
