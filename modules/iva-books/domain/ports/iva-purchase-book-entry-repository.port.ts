import type { IvaPurchaseBookEntry } from "../iva-purchase-book-entry.entity";

/**
 * Read/write port for the `IvaPurchaseBookEntry` aggregate. Tx-aware
 * methods únicamente — split simétrico con `IvaSalesBookEntryRepository`.
 * Todos los use cases A2 mutan dentro de `IvaBookUnitOfWork.run` o
 * comparten scope vía F-α scope-passing (`applyVoidCascade`).
 *
 * Mirror purchase-hex `PurchaseRepository` pattern (tx-aware suffix +
 * narrow shape) pero sin `findAll` / `findById` non-tx — IVA-hex use cases
 * A2 no exponen read-only inbound.
 *
 * `findByPurchaseIdTx` cubre el path cascade — `applyVoidCascade(input,
 * scope)` resuelve la entry asociada a un `purchaseId` dentro de la tx
 * parent del caller (legacy `recomputeFromPurchaseCascade:618-659` parity,
 * no-op si no existe entry para el purchaseId).
 */
export interface IvaPurchaseBookEntryRepository {
  /** Tx-aware load por `id` — usado por recompute / void / reactivate. */
  findByIdTx(
    organizationId: string,
    id: string,
  ): Promise<IvaPurchaseBookEntry | null>;

  /** Tx-aware load por `purchaseId` — usado por `applyVoidCascade`. */
  findByPurchaseIdTx(
    organizationId: string,
    purchaseId: string,
  ): Promise<IvaPurchaseBookEntry | null>;

  /** Tx-aware persist de un aggregate freshly-created (regenerate). */
  saveTx(entry: IvaPurchaseBookEntry): Promise<IvaPurchaseBookEntry>;

  /** Tx-aware persist de un aggregate existente (recompute / void / reactivate / cascade). */
  updateTx(entry: IvaPurchaseBookEntry): Promise<IvaPurchaseBookEntry>;
}
