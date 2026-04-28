import type { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import type { Payable } from "./payable.entity";
import type { PayableStatus } from "./value-objects/payable-status";

export interface PayableFilters {
  contactId?: string;
  status?: PayableStatus;
  dueDateFrom?: Date;
  dueDateTo?: Date;
}

export interface OpenAggregate {
  totalBalance: number;
  count: number;
}

export interface PendingDocumentSnapshot {
  id: string;
  description: string;
  amount: number;
  paid: number;
  balance: number;
  dueDate: Date;
  sourceType: string | null;
  sourceId: string | null;
  createdAt: Date;
}

export interface CreatePayableTxData {
  organizationId: string;
  contactId: string;
  description: string;
  amount: number;
  dueDate: Date;
  sourceType?: string;
  sourceId?: string;
  journalEntryId?: string;
}

export interface PayableRepository {
  findAll(organizationId: string, filters?: PayableFilters): Promise<Payable[]>;
  findById(organizationId: string, id: string): Promise<Payable | null>;
  save(payable: Payable): Promise<void>;
  update(payable: Payable): Promise<void>;
  aggregateOpen(organizationId: string, contactId?: string): Promise<OpenAggregate>;
  findPendingByContact(
    organizationId: string,
    contactId: string,
  ): Promise<PendingDocumentSnapshot[]>;

  /** Tx-aware creation used by purchase orchestration. */
  createTx(tx: unknown, data: CreatePayableTxData): Promise<{ id: string }>;
  /** Tx-aware void used by purchase orchestration. */
  voidTx(tx: unknown, organizationId: string, id: string): Promise<void>;

  /** Tx-aware load used by payment orchestration (allocation use cases). */
  findByIdTx(
    tx: unknown,
    organizationId: string,
    id: string,
  ): Promise<Payable | null>;

  /**
   * Tx-aware allocation persister. Receives the COMPUTED state (paid, balance,
   * status) from the entity — the repo is a dumb persister, no calculation here.
   */
  applyAllocationTx(
    tx: unknown,
    organizationId: string,
    id: string,
    paid: MonetaryAmount,
    balance: MonetaryAmount,
    status: PayableStatus,
  ): Promise<void>;

  /**
   * Tx-aware revert persister. Receives the COMPUTED state (paid, balance,
   * status) from the entity — the repo is a dumb persister, no calculation here.
   */
  revertAllocationTx(
    tx: unknown,
    organizationId: string,
    id: string,
    paid: MonetaryAmount,
    balance: MonetaryAmount,
    status: PayableStatus,
  ): Promise<void>;
}
