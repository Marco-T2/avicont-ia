import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import {
  type PayableStatus,
  canTransition,
} from "./value-objects/payable-status";
import {
  InvalidPayableStatusTransition,
  PartialPaymentAmountRequired,
} from "./errors/payable-errors";

export interface PayableProps {
  id: string;
  organizationId: string;
  contactId: string;
  description: string;
  amount: MonetaryAmount;
  paid: MonetaryAmount;
  balance: MonetaryAmount;
  dueDate: Date;
  status: PayableStatus;
  sourceType: string | null;
  sourceId: string | null;
  journalEntryId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePayableInput {
  organizationId: string;
  contactId: string;
  description: string;
  amount: number | string;
  dueDate: Date;
  sourceType?: string | null;
  sourceId?: string | null;
  journalEntryId?: string | null;
  notes?: string | null;
}

export interface UpdatePayableInput {
  description?: string;
  dueDate?: Date;
  sourceType?: string | null;
  sourceId?: string | null;
  journalEntryId?: string | null;
  notes?: string | null;
}

export interface PayableSnapshot {
  id: string;
  organizationId: string;
  contactId: string;
  description: string;
  amount: number;
  paid: number;
  balance: number;
  dueDate: Date;
  status: PayableStatus;
  sourceType: string | null;
  sourceId: string | null;
  journalEntryId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Payable {
  private constructor(private readonly props: PayableProps) {}

  static create(input: CreatePayableInput): Payable {
    const now = new Date();
    const amount = MonetaryAmount.of(input.amount);
    return new Payable({
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      contactId: input.contactId,
      description: input.description,
      amount,
      paid: MonetaryAmount.zero(),
      balance: amount,
      dueDate: input.dueDate,
      status: "PENDING",
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      journalEntryId: input.journalEntryId ?? null,
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: PayableProps): Payable {
    return new Payable(props);
  }

  get id(): string { return this.props.id; }
  get organizationId(): string { return this.props.organizationId; }
  get contactId(): string { return this.props.contactId; }
  get description(): string { return this.props.description; }
  get amount(): MonetaryAmount { return this.props.amount; }
  get paid(): MonetaryAmount { return this.props.paid; }
  get balance(): MonetaryAmount { return this.props.balance; }
  get dueDate(): Date { return this.props.dueDate; }
  get status(): PayableStatus { return this.props.status; }
  get sourceType(): string | null { return this.props.sourceType; }
  get sourceId(): string | null { return this.props.sourceId; }
  get journalEntryId(): string | null { return this.props.journalEntryId; }
  get notes(): string | null { return this.props.notes; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  update(input: UpdatePayableInput): Payable {
    const next: PayableProps = { ...this.props, updatedAt: new Date() };
    if (input.description !== undefined) next.description = input.description;
    if (input.dueDate !== undefined) next.dueDate = input.dueDate;
    if ("sourceType" in input) next.sourceType = input.sourceType ?? null;
    if ("sourceId" in input) next.sourceId = input.sourceId ?? null;
    if ("journalEntryId" in input) next.journalEntryId = input.journalEntryId ?? null;
    if ("notes" in input) next.notes = input.notes ?? null;
    return new Payable(next);
  }

  transitionTo(target: PayableStatus, paidAmount?: number | string): Payable {
    if (!canTransition(this.props.status, target)) {
      throw new InvalidPayableStatusTransition(this.props.status, target);
    }

    let newPaid = this.props.paid;
    let newBalance = this.props.balance;

    if (target === "PAID") {
      newPaid = this.props.amount;
      newBalance = MonetaryAmount.zero();
    } else if (target === "PARTIAL") {
      if (paidAmount === undefined) {
        throw new PartialPaymentAmountRequired();
      }
      newPaid = MonetaryAmount.of(paidAmount);
      newBalance = this.props.amount.minus(newPaid);
    } else if (target === "VOIDED") {
      newBalance = MonetaryAmount.zero();
    }

    return new Payable({
      ...this.props,
      status: target,
      paid: newPaid,
      balance: newBalance,
      updatedAt: new Date(),
    });
  }

  void(): Payable {
    return this.transitionTo("VOIDED");
  }

  toSnapshot(): PayableSnapshot {
    return {
      id: this.props.id,
      organizationId: this.props.organizationId,
      contactId: this.props.contactId,
      description: this.props.description,
      amount: this.props.amount.value,
      paid: this.props.paid.value,
      balance: this.props.balance.value,
      dueDate: this.props.dueDate,
      status: this.props.status,
      sourceType: this.props.sourceType,
      sourceId: this.props.sourceId,
      journalEntryId: this.props.journalEntryId,
      notes: this.props.notes,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
