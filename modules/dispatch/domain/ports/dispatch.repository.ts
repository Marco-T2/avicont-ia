import type { Dispatch } from "../dispatch.entity";
import type { DispatchDetail } from "../dispatch-detail.entity";
import type { DispatchType } from "../value-objects/dispatch-type";
import type { DispatchStatus } from "../value-objects/dispatch-status";
import type { ComputedDetail } from "../compute-line-amounts";
import type { BcSummary } from "../compute-bc-summary";
import type {
  PaginationOptions,
  PaginatedResult,
} from "@/modules/shared/domain/value-objects/pagination";

export interface DispatchFilters {
  dispatchType?: DispatchType;
  status?: DispatchStatus;
  contactId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  periodId?: string;
}

/**
 * Read/write port for the `Dispatch` aggregate.
 *
 * Non-tx methods: used by read-only use cases.
 * Tx-aware methods: used inside transactional write flows.
 *
 * Mirror: modules/sale/domain/ports/sale.repository.ts pattern. Pagination
 * cascade additive-transitional: `findAll` preserved alongside `findPaginated`
 * per Journal POC precedent (§13 sales-unified-pagination-union-cascade D1).
 */
export interface DispatchRepository {
  findById(organizationId: string, id: string): Promise<Dispatch | null>;
  findAll(organizationId: string, filters?: DispatchFilters): Promise<Dispatch[]>;
  /**
   * Paginated read — mirror Sale `findPaginated` shape. Returns
   * `PaginatedResult<Dispatch>` (items + total + page + pageSize + totalPages).
   * Used by `/sales` RSC twin-call UNION pagination (poc-sales-unified-pagination).
   */
  findPaginated(
    organizationId: string,
    filters?: DispatchFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Dispatch>>;

  /** Tx-aware load — used by edit/post/void use cases. */
  findByIdTx(organizationId: string, id: string): Promise<Dispatch | null>;

  /** Tx-aware persist of a freshly-created aggregate (DRAFT or POSTED). */
  saveTx(dispatch: Dispatch): Promise<Dispatch>;

  /**
   * Tx-aware update of an existing aggregate — header + optional detail replace.
   */
  updateTx(
    dispatch: Dispatch,
    options: {
      replaceDetails: boolean;
      computedDetails?: ComputedDetail[];
      bcSummary?: BcSummary;
    },
  ): Promise<Dispatch>;

  /** Tx-aware delete — only valid for DRAFT. */
  deleteTx(organizationId: string, id: string): Promise<void>;

  /** Tx-aware sequence allocator. */
  getNextSequenceNumberTx(
    organizationId: string,
    dispatchType: DispatchType,
  ): Promise<number>;

  /** Links journal entry and receivable IDs to the dispatch. */
  linkJournalAndReceivableTx(
    organizationId: string,
    id: string,
    journalEntryId: string,
    receivableId: string,
  ): Promise<void>;

  /** Updates status + optional totalAmount/sequenceNumber. */
  updateStatusTx(
    organizationId: string,
    id: string,
    status: DispatchStatus,
    totalAmount?: number,
    sequenceNumber?: number,
  ): Promise<Dispatch>;

  /** Clones a dispatch to a new DRAFT (recreate flow). */
  cloneToDraftTx(
    organizationId: string,
    source: Dispatch,
  ): Promise<Dispatch>;
}
