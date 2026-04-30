/**
 * IVA-side reader outbound port — purchase → IVA. Read-only: resuelve el
 * snapshot ACTIVE de `ivaPurchaseBook` para una compra durante `post` /
 * `regenerateJournalForIvaChange` para que purchase-hex pueda construir
 * journal lines reflejando el shape IVA (paridad legacy
 * `extractIvaBookForEntry` purchase.service.ts:230-242).
 *
 * Read-only port — vive OUTSIDE `PurchaseScope` (paridad simétrica con
 * sale-hex `IvaBookReaderPort` y `FiscalPeriodsReadPort`). Resuelve antes
 * de que la UoW tx abra.
 *
 * **Temporal §5.5** — purchase-hex leyendo `ivaPurchaseBook` cross-module
 * es legacy shape. Retirado en POC #11.0c cuando purchase-hex consuma un
 * read-model proyectado por IVA-hex (o IVA-hex inyecte el snapshot como
 * parámetro al use case).
 *
 * Asimetría con sale-hex `IvaBookReaderPort.getActiveBookForSale`:
 * el legacy usa tablas distintas (`ivaSalesBook` vs `ivaPurchaseBook`),
 * por lo que cada módulo tiene su propio port con método específico.
 * Compartir port = forzar acoplamiento sin valor (los métodos serían
 * disjoint: ningún consumer usa ambos).
 */
export interface IvaBookSnapshot {
  id: string;
  purchaseId: string;
  ivaRate: number;
  ivaAmount: number;
  netAmount: number;
  /**
   * Importe exento/tasa-cero/no-sujeto residual proveniente del row
   * `ivaPurchaseBook.exentos` (legacy `extractIvaBookForEntry` parity).
   * Necesario para honrar la invariante `baseIvaSujetoCf + exentos =
   * importeTotal` en `buildPurchaseEntryLines`.
   */
  exentos: number;
}

export interface IvaBookReaderPort {
  /**
   * Returns the ACTIVE iva book snapshot for the purchase, or `null` if no
   * active book exists (legacy `extractIvaBookForEntry` returns the row or
   * skips IVA extraction silently).
   */
  getActiveBookForPurchase(
    organizationId: string,
    purchaseId: string,
  ): Promise<IvaBookSnapshot | null>;
}
