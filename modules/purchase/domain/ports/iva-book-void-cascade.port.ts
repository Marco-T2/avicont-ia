/**
 * IVA cascade outbound port — purchase → IVA. Marca la entry IVA-side book
 * como voided cuando la compra se anula (legacy
 * `purchase.service.ts:1361-1367 voidCascadeTx` parity, escribe
 * `ivaPurchaseBook` directly). Tx-bound: vive INSIDE `PurchaseScope` para
 * que el write IVA rollback con el purchase void. Espejo simétrico de
 * sale-hex `IvaBookVoidCascadePort`.
 *
 * **Temporal §5.5** — purchase-hex escribiendo el IVA book directamente
 * es legacy shape, NO target architecture. Retirado en POC #11.0c cuando
 * IVA-hex owns el status update via event subscription o projection. Hasta
 * entonces el adapter escribe `ivaPurchaseBook` directly via Prisma
 * (paridad legacy `voidCascadeTx:1361-1367`, no service-level cascade
 * method exists).
 */
export interface IvaBookVoidCascadePort {
  markVoidedFromPurchase(
    organizationId: string,
    purchaseId: string,
  ): Promise<void>;
}
