import type { IvaBookForEntry } from "../build-purchase-entry-lines";

/**
 * IVA cascade outbound port — purchase → IVA. Notifica al IVA-side book
 * recomputar totales cuando una compra POSTED cambia su totalAmount (legacy
 * `purchase.service.ts:1078 recomputeFromPurchaseCascade` parity). Tx-bound:
 * vive INSIDE `PurchaseScope` para que el write IVA rollback con el write
 * purchase. Espejo simétrico de sale-hex `IvaBookRegenNotifierPort`.
 *
 * **Temporal §5.5** — declarado como port para mantener purchase-hex
 * desacoplado del legacy `IvaBooksService`, NO como endorsement de
 * acoplamiento bidireccional. Retirado en POC #11.0c cuando IVA-hex se
 * suscriba a un purchase event o lea de un projected snapshot. Hasta
 * entonces, el adapter wraps el legacy service directamente.
 *
 * Returns el `IvaBookForEntry` recomputado (purchase-side shape) para que
 * purchase-hex rebuild journal lines reflecting el nuevo IVA shape (legacy
 * `editPosted:1063-1076` usa `calcTotales` para derivar
 * baseIvaSujetoCf/dfCfIva/exentos para el nuevo total). Returns `null`
 * cuando no hay IVA book activo para la compra.
 *
 * **Contrato port (D1.7 c audit A2)** — `newTotal` se pasa por argumento
 * desde el use case que tiene el aggregate ya editado en memoria. El
 * adapter NO debe leer `purchase.totalAmount` de DB — dentro de la tx el
 * row está pre-edit hasta que `purchases.updateTx` commitee, y el orden
 * del callback hex llama recompute ANTES de updateTx (defensa estructural
 * vs paridad legacy `:1078` que llama al final por visibility tx). Si un
 * adapter futuro necesita campos additional del purchase, agregarlos al
 * signature explícitamente — NO hacer side-read de DB.
 */
export interface IvaBookRegenNotifierPort {
  recomputeFromPurchase(
    organizationId: string,
    purchaseId: string,
    newTotal: number,
  ): Promise<IvaBookForEntry | null>;
}
