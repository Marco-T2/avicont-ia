import type { Payment } from "./payment.entity";
import type { PaymentStatus } from "./value-objects/payment-status";
import type { PaymentMethod } from "./value-objects/payment-method";
import type {
  PaginatedResult,
  PaginationOptions,
} from "@/modules/shared/domain/value-objects/pagination";

export interface PaymentFilters {
  status?: PaymentStatus;
  method?: PaymentMethod;
  contactId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  periodId?: string;
}

/**
 * Snapshot returned by findUnappliedByContact() — used by the contact balance
 * UI to list payments that still have unapplied funds available as credit.
 */
export interface UnappliedPaymentSnapshot {
  id: string;
  date: Date;
  amount: number;
  description: string;
  totalAllocated: number;
  available: number;
}

export interface CustomerBalanceSnapshot {
  totalInvoiced: number;
  totalPaid: number;
  netBalance: number;
  unappliedCredit: number;
}

/**
 * Port for persisting and querying Payment aggregates. The implementation
 * lives in modules/payment/infrastructure/ and is the only place allowed to
 * touch Prisma (R5).
 *
 * All mutating methods come in tx-aware variants that take `tx: unknown` —
 * the adapter casts to `Prisma.TransactionClient` internally. The known
 * `unknown` leak is documented in §12 of docs/architecture.md.
 *
 * Persistence pattern: the aggregate computes its own state (status,
 * allocations, journalEntryId) — the adapter is a dumb persister that maps
 * the snapshot to columns. No business logic in infrastructure.
 */
export interface PaymentRepository {
  // ── Read ──

  findAll(
    organizationId: string,
    filters?: PaymentFilters,
  ): Promise<Payment[]>;

  findPaginated(
    organizationId: string,
    filters?: PaymentFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Payment>>;

  findById(organizationId: string, id: string): Promise<Payment | null>;

  findByIdTx(
    tx: unknown,
    organizationId: string,
    id: string,
  ): Promise<Payment | null>;

  findUnappliedByContact(
    organizationId: string,
    contactId: string,
    excludePaymentId?: string,
  ): Promise<UnappliedPaymentSnapshot[]>;

  getCustomerBalance(
    organizationId: string,
    contactId: string,
  ): Promise<CustomerBalanceSnapshot>;

  // ── Write (non-tx convenience for DRAFT create / list-then-edit flows) ──

  save(payment: Payment): Promise<void>;
  update(payment: Payment): Promise<void>;
  delete(organizationId: string, id: string): Promise<void>;

  // ── Tx-aware writes (used by orchestrated use cases: post, void, update,
  //   updateAllocations, applyCreditToInvoice, createAndPost) ──

  /**
   * Run `fn` inside a transaction. Required by `withAuditTx`, which wires
   * audit context (userId / correlationId) onto the transaction before
   * delegating to the use case body.
   */
  transaction<T>(
    fn: (tx: unknown) => Promise<T>,
    options?: { timeout?: number; maxWait?: number },
  ): Promise<T>;

  saveTx(tx: unknown, payment: Payment): Promise<void>;

  /**
   * Persists the full aggregate state in one call: status, scalar fields,
   * journalEntryId, AND allocations (delete-then-recreate inside the tx).
   * This matches the "load → mutate → persist whole aggregate" flow that
   * the receivables module uses, adapted for an aggregate that owns child
   * entities.
   */
  updateTx(tx: unknown, payment: Payment): Promise<void>;

  deleteTx(tx: unknown, organizationId: string, id: string): Promise<void>;
}
