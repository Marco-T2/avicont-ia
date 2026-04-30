import type { IvaSalesBookEntry } from "../iva-sales-book-entry.entity";

/**
 * Read/write port for the `IvaSalesBookEntry` aggregate. Tx-aware methods
 * únicamente — todos los use cases A2 mutan dentro de
 * `IvaBookUnitOfWork.run` (regenerate / recompute / void / reactivate) o
 * comparten scope vía F-α scope-passing (`applyVoidCascade`). El adapter
 * Prisma A3 se construye contra el `Prisma.TransactionClient` abierto;
 * el in-memory fake registra mutaciones contra el `correlationId` del
 * scope.
 *
 * Mirror sale-hex `SaleRepository` pattern (tx-aware suffix + narrow shape)
 * pero sin `findAll` / `findById` non-tx — IVA-hex use cases A2 no exponen
 * read-only inbound (read use cases viven en sale-hex/purchase-hex que ya
 * consumen `IvaBookReaderPort` desde su domain).
 *
 * `findBySaleIdTx` cubre el path cascade — `applyVoidCascade(input, scope)`
 * resuelve la entry asociada a un `saleId` dentro de la tx parent del
 * caller (legacy `recomputeFromSaleCascade:559-602` parity, no-op si no
 * existe entry para el saleId).
 */
export interface IvaSalesBookEntryRepository {
  /** Tx-aware load por `id` — usado por recompute / void / reactivate. */
  findByIdTx(
    organizationId: string,
    id: string,
  ): Promise<IvaSalesBookEntry | null>;

  /** Tx-aware load por `saleId` — usado por `applyVoidCascade`. */
  findBySaleIdTx(
    organizationId: string,
    saleId: string,
  ): Promise<IvaSalesBookEntry | null>;

  /** Tx-aware persist de un aggregate freshly-created (regenerate). */
  saveTx(entry: IvaSalesBookEntry): Promise<IvaSalesBookEntry>;

  /** Tx-aware persist de un aggregate existente (recompute / void / reactivate / cascade). */
  updateTx(entry: IvaSalesBookEntry): Promise<IvaSalesBookEntry>;
}
