import type { Sale } from "../sale.entity";

export interface SaleFilters {
  contactId?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Read/write port for the `Sale` aggregate. Methods come in two flavours:
 *
 *   - Non-tx (`findById`, `findAll`): used by read-only use cases that resolve
 *     before the UoW opens.
 *   - Tx-aware (`saveTx`, `updateTx`, `findByIdTx`, `deleteTx`): used by write
 *     use cases inside `SaleUnitOfWork.run`. The Prisma adapter (A3) is
 *     constructed against the open `Prisma.TransactionClient`; the in-memory
 *     fake records mutations against the scope's correlation id.
 *
 * Hidratación: aggregates returned by `findById*` carry `details` populated.
 * `ReceivableSummary` and `PaymentAllocationSummary` (read-model VOs) are
 * hydrated separately by the `getEditPreview` use case via
 * `ReceivableRepository.findPendingByContact` — the sale repo does not cross
 * the receivables boundary.
 */
export interface SaleRepository {
  findById(organizationId: string, id: string): Promise<Sale | null>;
  findAll(organizationId: string, filters?: SaleFilters): Promise<Sale[]>;

  /** Tx-aware load — used by edit/post/void use cases that mutate inside UoW. */
  findByIdTx(
    organizationId: string,
    id: string,
  ): Promise<Sale | null>;

  /** Tx-aware persist of a freshly-created aggregate (DRAFT or POSTED). */
  saveTx(sale: Sale): Promise<Sale>;

  /**
   * Tx-aware persist of an existing aggregate. `options.replaceDetails` mirrors
   * the legacy delete-and-recreate behaviour for posted/locked edits — the
   * adapter writes the new header plus, when true, replaces `SaleDetail` rows.
   * Non-optional and explicit per call-site (parity with
   * `JournalEntriesRepository.update {replaceLines}` POC #10 C3-B).
   */
  updateTx(
    sale: Sale,
    options: { replaceDetails: boolean },
  ): Promise<Sale>;

  /** Tx-aware delete — only valid for DRAFT (caller enforces via aggregate). */
  deleteTx(organizationId: string, id: string): Promise<void>;
}
