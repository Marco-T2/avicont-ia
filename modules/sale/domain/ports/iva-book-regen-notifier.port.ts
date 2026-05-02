import type { IvaBookForEntry } from "../build-sale-entry-lines";

/**
 * IVA cascade outbound port — sale → IVA. Notifies the IVA-side book to
 * recompute totals when a posted sale's totalAmount changes (legacy
 * `editPosted` parity). Tx-bound: lives inside `SaleScope` so the IVA write
 * rolls back with the sale write.
 *
 * **Temporal §5.5** — declared as a port to keep sale-hex decoupled from the
 * legacy `IvaBooksService` (legacy class deleted POC siguiente A2-C3, engram
 * `poc-siguiente/a2/c3/closed`), NOT as endorsement of bidirectional coupling.
 * Retired in POC #11.0c when IVA-hex subscribes to a sale event or reads from
 * a projected snapshot owned by IVA. Adapter ahora wraps el hex `IvaBookService`
 * (post-A2-C3 cutover hex factory `makeIvaBookService`).
 *
 * Returns the recomputed `IvaBookForEntry` so sale-hex can rebuild journal
 * lines reflecting the new IVA shape (legacy `editPosted:717-740` uses
 * `calcTotales` to derive base/dfCfIva/exentos for the new total). Returns
 * `null` when no active IVA book exists for the sale.
 */
export interface IvaBookRegenNotifierPort {
  recomputeFromSale(
    organizationId: string,
    saleId: string,
    newTotal: number,
  ): Promise<IvaBookForEntry | null>;
}
