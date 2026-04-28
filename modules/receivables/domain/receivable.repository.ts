import type { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import type { Receivable } from "./receivable.entity";
import type { ReceivableStatus } from "./value-objects/receivable-status";

export interface ReceivableFilters {
  contactId?: string;
  status?: ReceivableStatus;
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

export interface CreateReceivableTxData {
  organizationId: string;
  contactId: string;
  description: string;
  amount: number;
  dueDate: Date;
  sourceType?: string;
  sourceId?: string;
  journalEntryId?: string;
}

export interface ReceivableRepository {
  findAll(organizationId: string, filters?: ReceivableFilters): Promise<Receivable[]>;
  findById(organizationId: string, id: string): Promise<Receivable | null>;
  save(receivable: Receivable): Promise<void>;
  update(receivable: Receivable): Promise<void>;
  aggregateOpen(organizationId: string, contactId?: string): Promise<OpenAggregate>;
  findPendingByContact(
    organizationId: string,
    contactId: string,
  ): Promise<PendingDocumentSnapshot[]>;

  /** Tx-aware creation used by dispatch/sale orchestration. */
  createTx(tx: unknown, data: CreateReceivableTxData): Promise<{ id: string }>;
  /** Tx-aware void used by dispatch/sale orchestration. */
  voidTx(tx: unknown, organizationId: string, id: string): Promise<void>;

  /** Tx-aware load used by payment orchestration (allocation use cases). */
  findByIdTx(
    tx: unknown,
    organizationId: string,
    id: string,
  ): Promise<Receivable | null>;

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
    status: ReceivableStatus,
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
    status: ReceivableStatus,
  ): Promise<void>;
}
