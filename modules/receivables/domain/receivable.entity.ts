import { MonetaryAmount } from "./value-objects/monetary-amount";
import {
  type ReceivableStatus,
  canTransition,
} from "./value-objects/receivable-status";
import {
  InvalidReceivableStatusTransition,
  PartialPaymentAmountRequired,
} from "./errors/receivable-errors";

export interface ReceivableProps {
  id: string;
  organizationId: string;
  contactId: string;
  description: string;
  amount: MonetaryAmount;
  paid: MonetaryAmount;
  balance: MonetaryAmount;
  dueDate: Date;
  status: ReceivableStatus;
  sourceType: string | null;
  sourceId: string | null;
  journalEntryId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReceivableInput {
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

export interface UpdateReceivableInput {
  description?: string;
  dueDate?: Date;
  sourceType?: string | null;
  sourceId?: string | null;
  journalEntryId?: string | null;
  notes?: string | null;
}

export interface ReceivableSnapshot {
  id: string;
  organizationId: string;
  contactId: string;
  description: string;
  amount: number;
  paid: number;
  balance: number;
  dueDate: Date;
  status: ReceivableStatus;
  sourceType: string | null;
  sourceId: string | null;
  journalEntryId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Receivable {
  private constructor(private readonly props: ReceivableProps) {}

  static create(input: CreateReceivableInput): Receivable {
    const now = new Date();
    const amount = MonetaryAmount.of(input.amount);
    return new Receivable({
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

  static fromPersistence(props: ReceivableProps): Receivable {
    return new Receivable(props);
  }

  get id(): string { return this.props.id; }
  get organizationId(): string { return this.props.organizationId; }
  get contactId(): string { return this.props.contactId; }
  get description(): string { return this.props.description; }
  get amount(): MonetaryAmount { return this.props.amount; }
  get paid(): MonetaryAmount { return this.props.paid; }
  get balance(): MonetaryAmount { return this.props.balance; }
  get dueDate(): Date { return this.props.dueDate; }
  get status(): ReceivableStatus { return this.props.status; }
  get sourceType(): string | null { return this.props.sourceType; }
  get sourceId(): string | null { return this.props.sourceId; }
  get journalEntryId(): string | null { return this.props.journalEntryId; }
  get notes(): string | null { return this.props.notes; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  update(input: UpdateReceivableInput): Receivable {
    const next: ReceivableProps = { ...this.props, updatedAt: new Date() };
    if (input.description !== undefined) next.description = input.description;
    if (input.dueDate !== undefined) next.dueDate = input.dueDate;
    if ("sourceType" in input) next.sourceType = input.sourceType ?? null;
    if ("sourceId" in input) next.sourceId = input.sourceId ?? null;
    if ("journalEntryId" in input) next.journalEntryId = input.journalEntryId ?? null;
    if ("notes" in input) next.notes = input.notes ?? null;
    return new Receivable(next);
  }

  transitionTo(target: ReceivableStatus, paidAmount?: number | string): Receivable {
    if (!canTransition(this.props.status, target)) {
      throw new InvalidReceivableStatusTransition(this.props.status, target);
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

    return new Receivable({
      ...this.props,
      status: target,
      paid: newPaid,
      balance: newBalance,
      updatedAt: new Date(),
    });
  }

  void(): Receivable {
    return this.transitionTo("VOIDED");
  }

  toSnapshot(): ReceivableSnapshot {
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
