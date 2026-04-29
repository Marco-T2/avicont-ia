/**
 * IVA cascade outbound port — sale → IVA. Notifies the IVA-side book to
 * recompute totals when a posted sale's totalAmount changes (legacy
 * `editPosted` parity). Tx-bound: lives inside `SaleScope` so the IVA write
 * rolls back with the sale write.
 *
 * **Temporal §5.5** — declared as a port to keep sale-hex decoupled from the
 * legacy `IvaBooksService`, NOT as endorsement of bidirectional coupling.
 * Retired in POC #11.0c when IVA-hex subscribes to a sale event or reads from
 * a projected snapshot owned by IVA. Until then the adapter wraps the legacy
 * service directly.
 */
export interface IvaBookRegenNotifierPort {
  recomputeFromSale(
    organizationId: string,
    saleId: string,
    newTotal: number,
  ): Promise<void>;
}
