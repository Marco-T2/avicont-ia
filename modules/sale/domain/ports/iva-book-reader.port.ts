/**
 * IVA-side reader outbound port — sale → IVA. Read-only: resolves the ACTIVE
 * `ivaSalesBook` snapshot for a sale during `regenerateJournalForIvaChange`
 * so sale-hex can rebuild journal lines reflecting the new IVA shape (legacy
 * `extractIvaBookForEntry` parity).
 *
 * Read-only port — lives OUTSIDE `SaleScope` (parity with
 * `FiscalPeriodsReadPort`). Resolves before the UoW tx opens.
 *
 * **Temporal §5.5** — sale-hex reading `ivaSalesBook` cross-module is legacy
 * shape. Retired in POC #11.0c when sale-hex consumes a read-model projected
 * by IVA-hex (or IVA-hex injects the snapshot as a parameter to the use case).
 */
export interface IvaBookSnapshot {
  id: string;
  saleId: string;
  ivaRate: number;
  ivaAmount: number;
  netAmount: number;
  /**
   * Importe exento/tasa-cero/no-sujeto residual proveniente del row
   * `ivaSalesBook.exentos` (legacy `extractIvaBookForEntry:137` parity).
   * Necesario para honrar la invariante `baseIvaSujetoCf + exentos =
   * importeTotal` en `buildSaleEntryLines` — sin propagación, el helper
   * derivaría exentos como fallback `importeTotal − baseIvaSujetoCf`,
   * silenciando rows con invariante violada que legacy fail-loud.
   */
  exentos: number;
}

export interface IvaBookReaderPort {
  /**
   * Returns the ACTIVE iva book snapshot for the sale, or `null` if no active
   * book exists (legacy `extractIvaBookForEntry` returns the row or skips IVA
   * extraction silently).
   */
  getActiveBookForSale(
    organizationId: string,
    saleId: string,
  ): Promise<IvaBookSnapshot | null>;
}
