/**
 * IVA cascade outbound port — sale → IVA. Marks the IVA-side book entry as
 * voided when the sale is voided (legacy `voidCascadeTx` parity, writes
 * `ivaSalesBook` directly). Tx-bound: lives inside `SaleScope` so the IVA
 * write rolls back with the sale void.
 *
 * **Temporal §5.5** — sale-hex writing the IVA book directly is the legacy
 * shape, not the target architecture. Retired in POC #11.0c when IVA-hex
 * owns the status update via event subscription or projection. Until then
 * the adapter wraps the legacy `IvaBooksService.markVoidedFromSale` path.
 */
export interface IvaBookVoidCascadePort {
  markVoidedFromSale(
    organizationId: string,
    saleId: string,
  ): Promise<void>;
}
