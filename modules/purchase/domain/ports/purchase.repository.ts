import type { Purchase } from "../purchase.entity";

export interface PurchaseFilters {
  contactId?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Read/write port for the `Purchase` aggregate. Mirror simétrico a
 * `SaleRepository` (sale-hex) — la asimetría purchase vive en el aggregate
 * (4 purchaseTypes, polymorphic surface), no en el port shape.
 *
 *   - Non-tx (`findById`, `findAll`): read-only use cases que resuelven
 *     antes que la UoW abra.
 *   - Tx-aware (`saveTx`, `updateTx`, `findByIdTx`, `deleteTx`,
 *     `getNextSequenceNumberTx`): write use cases dentro de
 *     `PurchaseUnitOfWork.run`.
 *
 * Hidratación: aggregates devueltos por `findById*` traen `details` poblado
 * y `payable: PayableSummary | null`. `PaymentAllocationSummary` (read-model
 * VO) se hidrata por separado en el use case `getEditPreview` vía
 * `PayableRepository.findPendingByContact` (paralelo a sale-hex con
 * receivables) — el repo no cruza el boundary de payables.
 */
export interface PurchaseRepository {
  findById(organizationId: string, id: string): Promise<Purchase | null>;
  findAll(organizationId: string, filters?: PurchaseFilters): Promise<Purchase[]>;

  /** Tx-aware load — used by edit/post/void use cases that mutate inside UoW. */
  findByIdTx(
    organizationId: string,
    id: string,
  ): Promise<Purchase | null>;

  /** Tx-aware persist of a freshly-created aggregate (DRAFT or POSTED). */
  saveTx(purchase: Purchase): Promise<Purchase>;

  /**
   * Tx-aware persist of an existing aggregate. `options.replaceDetails`
   * mirrors the legacy delete-and-recreate behaviour for posted/locked edits
   * — el adapter escribe el header nuevo y, cuando true, reemplaza
   * `PurchaseDetail` rows. Explícito por call-site (paridad simétrica con
   * sale-hex `updateTx`).
   */
  updateTx(
    purchase: Purchase,
    options: { replaceDetails: boolean },
  ): Promise<Purchase>;

  /** Tx-aware hard delete — sólo válido para DRAFT (caller enforcea). */
  deleteTx(organizationId: string, id: string): Promise<void>;

  /**
   * Tx-aware sequence allocator. Devuelve el próximo `sequenceNumber` para la
   * org. Espejo simétrico a sale-hex `SaleRepository.getNextSequenceNumberTx`
   * — paridad legacy regla #1: `MAX(sequenceNumber) + 1` SIN row lock; la
   * unicidad la garantiza el `@@unique([organizationId, sequenceNumber])` del
   * schema. Concurrencia → `P2002` aborta tx (legacy no tiene retry; el
   * adapter tampoco).
   */
  getNextSequenceNumberTx(organizationId: string): Promise<number>;
}
