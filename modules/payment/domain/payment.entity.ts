import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import {
  type PaymentStatus,
  canTransition,
} from "./value-objects/payment-status";
import type { PaymentMethod } from "./value-objects/payment-method";
import type { PaymentDirection } from "./value-objects/payment-direction";
import type { AllocationTarget } from "./value-objects/allocation-target";
import {
  PaymentAllocation,
  type PaymentAllocationSnapshot,
} from "./payment-allocation.entity";
import {
  InvalidPaymentStatusTransition,
  PaymentMixedAllocation,
  PaymentAllocationsExceedTotal,
  CannotModifyVoidedPayment,
} from "./errors/payment-errors";

export interface PaymentProps {
  id: string;
  organizationId: string;
  status: PaymentStatus;
  method: PaymentMethod;
  date: Date;
  amount: MonetaryAmount;
  description: string;
  periodId: string;
  contactId: string;
  referenceNumber: number | null;
  journalEntryId: string | null;
  notes: string | null;
  accountCode: string | null;
  operationalDocTypeId: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  allocations: PaymentAllocation[];
}

export interface AllocationDraft {
  target: AllocationTarget;
  amount: number | string;
}

export interface CreatePaymentInput {
  organizationId: string;
  method: PaymentMethod;
  date: Date;
  amount: number | string;
  description: string;
  periodId: string;
  contactId: string;
  createdById: string;
  referenceNumber?: number | null;
  journalEntryId?: string | null;
  notes?: string | null;
  accountCode?: string | null;
  operationalDocTypeId?: string | null;
  allocations?: AllocationDraft[];
}

export interface UpdatePaymentInput {
  method?: PaymentMethod;
  date?: Date;
  amount?: number | string;
  description?: string;
  referenceNumber?: number | null;
  notes?: string | null;
  accountCode?: string | null;
  operationalDocTypeId?: string | null;
}

export interface PaymentSnapshot {
  id: string;
  organizationId: string;
  status: PaymentStatus;
  method: PaymentMethod;
  date: Date;
  amount: number;
  description: string;
  periodId: string;
  contactId: string;
  referenceNumber: number | null;
  journalEntryId: string | null;
  notes: string | null;
  accountCode: string | null;
  operationalDocTypeId: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  allocations: PaymentAllocationSnapshot[];
}

/**
 * Payment is the aggregate root that owns the PaymentAllocation child entities.
 * All mutations on allocations go through this aggregate so the cross-allocation
 * invariants (homogeneous direction, sum ≤ amount) are enforced in one place.
 *
 * Invariants enforced inside the aggregate:
 *   - All allocations target the same direction (RECEIVABLE xor PAYABLE) — PAYMENT_MIXED_ALLOCATION
 *   - sum(allocations.amount) <= amount — PAYMENT_ALLOCATIONS_EXCEED_TOTAL
 *   - VOIDED is terminal: every mutator throws CannotModifyVoidedPayment / InvalidPaymentStatusTransition
 *
 * Status lifecycle (DRAFT → POSTED → LOCKED → VOIDED, with POSTED → VOIDED also
 * allowed) is enforced via canTransition() on the PaymentStatus VO.
 */
export class Payment {
  private constructor(private readonly props: PaymentProps) {}

  static create(input: CreatePaymentInput): Payment {
    const now = new Date();
    const id = crypto.randomUUID();
    const amount = MonetaryAmount.of(input.amount);

    const allocations = (input.allocations ?? []).map((a) =>
      PaymentAllocation.create({
        paymentId: id,
        target: a.target,
        amount: a.amount,
      }),
    );

    enforceAllocationInvariants(allocations, amount);

    return new Payment({
      id,
      organizationId: input.organizationId,
      status: "DRAFT",
      method: input.method,
      date: input.date,
      amount,
      description: input.description,
      periodId: input.periodId,
      contactId: input.contactId,
      referenceNumber: input.referenceNumber ?? null,
      journalEntryId: input.journalEntryId ?? null,
      notes: input.notes ?? null,
      accountCode: input.accountCode ?? null,
      operationalDocTypeId: input.operationalDocTypeId ?? null,
      createdById: input.createdById,
      createdAt: now,
      updatedAt: now,
      allocations,
    });
  }

  static fromPersistence(props: PaymentProps): Payment {
    return new Payment(props);
  }

  // ── Getters ──

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get status(): PaymentStatus {
    return this.props.status;
  }
  get method(): PaymentMethod {
    return this.props.method;
  }
  get date(): Date {
    return this.props.date;
  }
  get amount(): MonetaryAmount {
    return this.props.amount;
  }
  get description(): string {
    return this.props.description;
  }
  get periodId(): string {
    return this.props.periodId;
  }
  get contactId(): string {
    return this.props.contactId;
  }
  get referenceNumber(): number | null {
    return this.props.referenceNumber;
  }
  get journalEntryId(): string | null {
    return this.props.journalEntryId;
  }
  get notes(): string | null {
    return this.props.notes;
  }
  get accountCode(): string | null {
    return this.props.accountCode;
  }
  get operationalDocTypeId(): string | null {
    return this.props.operationalDocTypeId;
  }
  get createdById(): string {
    return this.props.createdById;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get allocations(): PaymentAllocation[] {
    return [...this.props.allocations];
  }

  /** Sum of all current allocation amounts. Derived — not persisted. */
  get totalAllocated(): MonetaryAmount {
    return this.props.allocations.reduce(
      (acc, a) => acc.plus(a.amount),
      MonetaryAmount.zero(),
    );
  }

  /** amount - totalAllocated. Derived — not persisted. */
  get unappliedAmount(): MonetaryAmount {
    return this.props.amount.minus(this.totalAllocated);
  }

  /**
   * Derived from allocations: COBRO if first allocation is a receivable,
   * PAGO if it's a payable, null when the payment has no allocations.
   * Application layer is responsible for resolving direction by other means
   * (e.g. Contact type lookup) when this returns null.
   */
  get direction(): PaymentDirection | null {
    const first = this.props.allocations[0];
    return first?.target.direction ?? null;
  }

  // ── Status transitions ──

  post(): Payment {
    return this.transitionTo("POSTED");
  }

  void(): Payment {
    return this.transitionTo("VOIDED");
  }

  lock(): Payment {
    return this.transitionTo("LOCKED");
  }

  private transitionTo(target: PaymentStatus): Payment {
    // Legacy parity (C2-FIX-2): when the current status is VOIDED, every
    // transition must surface the SHARED ENTRY_VOIDED_IMMUTABLE code (not the
    // generic INVALID_STATUS_TRANSITION). This matches
    // `validateTransition`'s first branch in
    // features/accounting/document-lifecycle.service.ts.
    if (this.props.status === "VOIDED") {
      throw new CannotModifyVoidedPayment();
    }
    if (!canTransition(this.props.status, target)) {
      throw new InvalidPaymentStatusTransition(this.props.status, target);
    }
    return new Payment({
      ...this.props,
      status: target,
      updatedAt: new Date(),
    });
  }

  // ── Mutators on non-status fields ──

  update(input: UpdatePaymentInput): Payment {
    this.assertNotVoided();
    const next: PaymentProps = { ...this.props, updatedAt: new Date() };
    if (input.method !== undefined) next.method = input.method;
    if (input.date !== undefined) next.date = input.date;
    if (input.amount !== undefined) {
      next.amount = MonetaryAmount.of(input.amount);
    }
    if (input.description !== undefined) next.description = input.description;
    if ("referenceNumber" in input) {
      next.referenceNumber = input.referenceNumber ?? null;
    }
    if ("notes" in input) next.notes = input.notes ?? null;
    if ("accountCode" in input) next.accountCode = input.accountCode ?? null;
    if ("operationalDocTypeId" in input) {
      next.operationalDocTypeId = input.operationalDocTypeId ?? null;
    }
    // Re-check the SUM ≤ amount invariant after potential amount change.
    enforceAllocationInvariants(next.allocations, next.amount);
    return new Payment(next);
  }

  /**
   * Replace the entire allocation list atomically. Used by both DRAFT edits
   * and POSTED/LOCKED reassignments (the entity does not enforce status here —
   * the application layer decides whether the transition is permitted given
   * role / locked-edit policy; the entity only enforces "not VOIDED").
   */
  replaceAllocations(next: PaymentAllocation[]): Payment {
    this.assertNotVoided();
    enforceAllocationInvariants(next, this.props.amount);
    return new Payment({
      ...this.props,
      allocations: [...next],
      updatedAt: new Date(),
    });
  }

  /**
   * Append a single allocation. Used by the "apply credit to invoice" use
   * case (an existing payment routes part of its unapplied funds to a new
   * receivable). The new allocation must respect direction homogeneity and
   * fit within the unapplied amount.
   */
  applyCreditAllocation(allocation: PaymentAllocation): Payment {
    this.assertNotVoided();
    const next = [...this.props.allocations, allocation];
    enforceAllocationInvariants(next, this.props.amount);
    return new Payment({
      ...this.props,
      allocations: next,
      updatedAt: new Date(),
    });
  }

  /** Wire the payment to its journal entry once the entry is created. */
  linkJournalEntry(journalEntryId: string): Payment {
    this.assertNotVoided();
    return new Payment({
      ...this.props,
      journalEntryId,
      updatedAt: new Date(),
    });
  }

  // ── Snapshot ──

  toSnapshot(): PaymentSnapshot {
    return {
      id: this.props.id,
      organizationId: this.props.organizationId,
      status: this.props.status,
      method: this.props.method,
      date: this.props.date,
      amount: this.props.amount.value,
      description: this.props.description,
      periodId: this.props.periodId,
      contactId: this.props.contactId,
      referenceNumber: this.props.referenceNumber,
      journalEntryId: this.props.journalEntryId,
      notes: this.props.notes,
      accountCode: this.props.accountCode,
      operationalDocTypeId: this.props.operationalDocTypeId,
      createdById: this.props.createdById,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
      allocations: this.props.allocations.map((a) => a.toSnapshot()),
    };
  }

  // ── Internals ──

  private assertNotVoided(): void {
    if (this.props.status === "VOIDED") {
      throw new CannotModifyVoidedPayment();
    }
  }
}

// ── Cross-allocation invariants (aggregate-level) ──

function enforceAllocationInvariants(
  allocations: PaymentAllocation[],
  amount: MonetaryAmount,
): void {
  if (allocations.length > 1) {
    const firstKind = allocations[0].target.kind;
    const homogeneous = allocations.every(
      (a) => a.target.kind === firstKind,
    );
    if (!homogeneous) {
      throw new PaymentMixedAllocation();
    }
  }

  const total = allocations.reduce(
    (acc, a) => acc.plus(a.amount),
    MonetaryAmount.zero(),
  );
  if (total.isGreaterThan(amount)) {
    throw new PaymentAllocationsExceedTotal();
  }
}
