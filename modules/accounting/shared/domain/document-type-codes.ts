import type { PurchaseType } from "@/modules/purchase/domain/purchase.entity";

/**
 * Prisma-free document-type-code helpers, domain-owned so application-layer
 * consumers (ledger.service, purchase.service) do not reach into
 * infrastructure (hex R2). The infra home
 * `modules/accounting/shared/infrastructure/document-type-codes.ts` re-exports
 * both for back-compat with untouched consumers.
 */

/**
 * Mapeo del union `PurchaseType` (domain-owned, purchase.entity.ts) al código
 * operacional físico.
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
