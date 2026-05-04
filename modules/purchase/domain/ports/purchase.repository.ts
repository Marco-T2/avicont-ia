import type { Purchase, PurchaseType } from "../purchase.entity";

export interface PurchaseFilters {
  /**
   * Asimetría purchase vs sale-hex (audit-5 D-A3-2): purchase schema tiene
   * discriminator `purchaseType` (4 valores). Legacy
   * legacy purchase.repository filtraba (post-A3-C8 atomic delete commit 4aa8480); consumer real
   * `app/api/organizations/[orgSlug]/purchases/route.ts:23` (cutover POC
   * #11.0c). Paralelo D-A3-1 (`getNextSequenceNumberTx` scoped).
   */
  purchaseType?: PurchaseType;
  contactId?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Read/write port for the `Purchase` aggregate. Mirror simétrico a
 * `SaleRepository` (sale-hex) — la asimetría purchase vive en el aggregate
 * (4 purchaseTypes, polymorphic surface) + 2 puntos puntuales del port shape:
 * filter `PurchaseFilters.purchaseType` (audit-5 D-A3-2) y sequence
 * `getNextSequenceNumberTx` scoped por `purchaseType` (audit-4 D-A3-1).
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
   * Tx-aware sequence allocator scoped por (`organizationId`, `purchaseType`).
   * Asimetría purchase vs sale-hex (audit-4 D-A3-1): purchase tiene 4
   * secuencias INDEPENDIENTES por `PurchaseType` (FLETE, POLLO_FAENADO,
   * COMPRA_GENERAL, SERVICIO) — paridad legacy regla #1 con
   * legacy purchase.repository (`where: { organizationId, purchaseType }` antes
   * del `MAX(sequenceNumber)+1` — post-A3-C8 atomic delete commit 4aa8480).
   * Schema constraint `@@unique([organizationId, purchaseType, sequenceNumber])`
   * + Convention §12 sub-prefix determinístico (FL-001 + CG-001 conviven en
   * misma org sin colisión). Sin row lock; concurrencia → `P2002` aborta tx
   * (legacy no tiene retry; el adapter tampoco).
   */
  getNextSequenceNumberTx(
    organizationId: string,
    purchaseType: PurchaseType,
  ): Promise<number>;
}
