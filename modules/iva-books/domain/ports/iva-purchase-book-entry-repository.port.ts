import type { IvaPurchaseBookEntry } from "../iva-purchase-book-entry.entity";
import type { IvaBookStatus } from "../value-objects/iva-book-status";

/**
 * Filter shape for non-tx list queries. Mirror legacy
 * `ListIvaBooksFilter` (features/accounting/iva-books/iva-books.repository.ts:18).
 */
export interface ListPurchasesQuery {
  fiscalPeriodId?: string;
  status?: IvaBookStatus;
}

/**
 * Read/write port for the `IvaPurchaseBookEntry` aggregate. Split simétrico
 * con `IvaSalesBookEntryRepository`. Tx-aware methods cubren todos los use
 * cases A2 que mutan dentro de `IvaBookUnitOfWork.run` (regenerate /
 * recompute / void / reactivate) o comparten scope vía F-α scope-passing
 * (`applyVoidCascade`). El adapter Prisma A3 se construye contra el
 * `Prisma.TransactionClient` abierto; el in-memory fake registra
 * mutaciones contra el `correlationId` del scope.
 *
 * **A2.5 amplía read surface non-tx** (`findById` + `findByPeriod`) para
 * servir el viewer use case desde `IvaBookService.{getPurchaseById,
 * listPurchasesByPeriod}` — ver Q1 lock POC #11.0c A4 Step 0 (anti-CQRS
 * pragmático alineado con purchase-hex precedent `PurchaseService`). El
 * bookmark A2 original asumía "reads viven en sale-hex/purchase-hex via
 * IvaBookReaderPort" — esa asunción cubre el bridge cross-module ("given
 * a purchase, find its IVA entry"), NO el viewer user-facing ("list IVA
 * libro por período" / "get IVA entry by own id"). A2.5 cierra el gap.
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

  /**
   * Non-tx load por `id` — A2.5. Viewer use case: el service traduce
   * `null` → `IvaBookNotFound("purchase")` throw en `getPurchaseById`.
   */
  findById(
    organizationId: string,
    id: string,
  ): Promise<IvaPurchaseBookEntry | null>;

  /**
   * Non-tx list filtrada por `fiscalPeriodId` y/o `status` — A2.5. Mirror
   * legacy `listPurchasesByPeriod` Prisma where + orderBy `fechaFactura asc`.
   */
  findByPeriod(
    organizationId: string,
    query: ListPurchasesQuery,
  ): Promise<IvaPurchaseBookEntry[]>;

  /** Tx-aware persist de un aggregate freshly-created (regenerate). */
  saveTx(entry: IvaPurchaseBookEntry): Promise<IvaPurchaseBookEntry>;

  /** Tx-aware persist de un aggregate existente (recompute / void / reactivate / cascade). */
  updateTx(entry: IvaPurchaseBookEntry): Promise<IvaPurchaseBookEntry>;
}
