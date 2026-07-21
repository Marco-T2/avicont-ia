import "server-only";
import type { DispatchType } from "@/generated/prisma/client";

// Back-compat re-exports — the Prisma-free helpers moved to the domain home
// (modules/accounting/shared/domain/document-type-codes.ts) so application
// consumers stop importing infrastructure (hex R2).
export {
  formatDocumentReferenceNumber,
  purchaseTypeToCode,
} from "@/modules/accounting/shared/domain/document-type-codes";

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
 * Código operacional físico fijo para Ventas. Sale NO tiene
 * `operationalDocType` configurable a diferencia de Payment — siempre se
 * surfacea como "VG" (Venta General).
 */
export const SALE_DOCUMENT_TYPE_CODE = "VG";

