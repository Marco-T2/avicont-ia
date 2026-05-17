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
