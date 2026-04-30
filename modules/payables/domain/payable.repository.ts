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

/**
 * Allocation snapshot ordered LIFO (newest first). Carries the minimum data
 * needed by the purchase-hex `computeTrimPlan` helper for the editPosted
 * preview use case. Excludes allocations whose underlying payment is VOIDED
 * — those are not eligible for trimming (legacy `purchase.service.ts:803`
 * parity). Espejo simétrico de sale-hex `AllocationLifoSnapshot` en
 * receivables/domain — promovido al port en POC #11.0b A2 Ciclo 2 (§13
 * emergente E-1) cuando purchase-hex pasó a ser 2do consumer real, paridad
 * con sale-hex Ciclo 3 (commit `c24224e`).
 */
export interface AllocationLifoSnapshot {
  id: string;
  amount: number;
  payment: { date: Date };
}

/**
 * Trim plan item — paridad simétrica de sale-hex `ReceivableTrimItem`.
 * Port-local DTO con sólo los fields que el persister necesita:
 * `allocationId` (target row) + `newAmount` (post-trim amount; si 0 →
 * delete). Caller (purchase-hex) mapea el preview output a este shape antes
 * de invocar.
 */
export interface PayableTrimItem {
  allocationId: string;
  newAmount: number;
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

  /**
   * Returns the allocations of `payableId` ordered LIFO (newest first),
   * excluding those whose payment is VOIDED. Used by purchase-hex
   * `getEditPreview` use case to simulate the LIFO trim plan when the user
   * proposes lowering a posted purchase's total. Espejo simétrico de
   * sale-hex `findAllocationsForReceivable`.
   */
  findAllocationsForPayable(
    organizationId: string,
    payableId: string,
  ): Promise<AllocationLifoSnapshot[]>;

  /**
   * Tx-aware persister para el LIFO trim plan computado por purchase-hex
   * `computeTrimPlan`. Por cada item: si `newAmount === 0` borra el row
   * allocation, si no actualiza `amount`. Espejo simétrico de sale-hex
   * `applyTrimPlanTx` (paridad legacy `purchase.service.ts:1043-1076`
   * in-line LIFO loop).
   */
  applyTrimPlanTx(
    tx: unknown,
    organizationId: string,
    payableId: string,
    items: PayableTrimItem[],
  ): Promise<void>;

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
