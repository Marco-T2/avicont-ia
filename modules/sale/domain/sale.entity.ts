import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import type { SaleStatus } from "./value-objects/sale-status";
import { SaleDetail } from "./sale-detail.entity";
import type { ReceivableSummary } from "./value-objects/receivable-summary";
import {
  SaleNoDetails,
  SaleNotDraft,
  InvalidSaleStatusTransition,
  SaleVoidedImmutable,
} from "./errors/sale-errors";

const VALID_TRANSITIONS: Record<SaleStatus, SaleStatus[]> = {
  DRAFT: ["POSTED"],
  POSTED: ["LOCKED", "VOIDED"],
  LOCKED: ["VOIDED"],
  VOIDED: [],
};

export interface SaleProps {
  id: string;
  organizationId: string;
  status: SaleStatus;
  sequenceNumber: number | null;
  date: Date;
  contactId: string;
  periodId: string;
  description: string;
  referenceNumber: number | null;
  notes: string | null;
  totalAmount: MonetaryAmount;
  journalEntryId: string | null;
  receivableId: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  details: SaleDetail[];
  receivable: ReceivableSummary | null;
}

export interface CreateSaleDraftDetailInput {
  description: string;
  lineAmount: MonetaryAmount;
  order?: number;
  quantity?: number;
  unitPrice?: number;
  incomeAccountId: string;
}

export interface CreateSaleDraftInput {
  organizationId: string;
  contactId: string;
  periodId: string;
  date: Date;
  description: string;
  createdById: string;
  referenceNumber?: number;
  notes?: string;
  details: CreateSaleDraftDetailInput[];
}

export interface ApplySaleEditInput {
  date?: Date;
  description?: string;
  contactId?: string;
  referenceNumber?: number | null;
  notes?: string | null;
}

export class Sale {
  private constructor(private readonly props: SaleProps) {}

  static createDraft(input: CreateSaleDraftInput): Sale {
    const id = crypto.randomUUID();
    const now = new Date();
    const details = input.details.map((d, idx) =>
      SaleDetail.create({
        saleId: id,
        description: d.description,
        lineAmount: d.lineAmount,
        order: d.order ?? idx,
        quantity: d.quantity,
        unitPrice: d.unitPrice,
        incomeAccountId: d.incomeAccountId,
      }),
    );
    const totalAmount = details.reduce(
      (sum, d) => sum.plus(d.lineAmount),
      MonetaryAmount.zero(),
    );
    return new Sale({
      id,
      organizationId: input.organizationId,
      status: "DRAFT",
      sequenceNumber: null,
      date: input.date,
      contactId: input.contactId,
      periodId: input.periodId,
      description: input.description,
      referenceNumber: input.referenceNumber ?? null,
      notes: input.notes ?? null,
      totalAmount,
      journalEntryId: null,
      receivableId: null,
      createdById: input.createdById,
      createdAt: now,
      updatedAt: now,
      details,
      receivable: null,
    });
  }

  static fromPersistence(props: SaleProps): Sale {
    return new Sale(props);
  }

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get status(): SaleStatus {
    return this.props.status;
  }
  get sequenceNumber(): number | null {
    return this.props.sequenceNumber;
  }
  get date(): Date {
    return this.props.date;
  }
  get contactId(): string {
    return this.props.contactId;
  }
  get periodId(): string {
    return this.props.periodId;
  }
  get description(): string {
    return this.props.description;
  }
  get referenceNumber(): number | null {
    return this.props.referenceNumber;
  }
  get notes(): string | null {
    return this.props.notes;
  }
  get totalAmount(): MonetaryAmount {
    return this.props.totalAmount;
  }
  get journalEntryId(): string | null {
    return this.props.journalEntryId;
  }
  get receivableId(): string | null {
    return this.props.receivableId;
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
  get details(): SaleDetail[] {
    return [...this.props.details];
  }
  get receivable(): ReceivableSummary | null {
    return this.props.receivable;
  }

  post(): Sale {
    this.assertCurrentNotVoided();
    if (!this.canTransitionTo("POSTED")) {
      throw new InvalidSaleStatusTransition(this.props.status, "POSTED");
    }
    if (this.props.details.length === 0) {
      throw new SaleNoDetails();
    }
    const totalAmount = this.props.details.reduce(
      (sum, d) => sum.plus(d.lineAmount),
      MonetaryAmount.zero(),
    );
    return new Sale({
      ...this.props,
      status: "POSTED",
      totalAmount,
      updatedAt: new Date(),
    });
  }

  void(): Sale {
    this.assertCurrentNotVoided();
    if (!this.canTransitionTo("VOIDED")) {
      throw new InvalidSaleStatusTransition(this.props.status, "VOIDED");
    }
    return new Sale({
      ...this.props,
      status: "VOIDED",
      updatedAt: new Date(),
    });
  }

  lock(): Sale {
    this.assertCurrentNotVoided();
    if (!this.canTransitionTo("LOCKED")) {
      throw new InvalidSaleStatusTransition(this.props.status, "LOCKED");
    }
    return new Sale({
      ...this.props,
      status: "LOCKED",
      updatedAt: new Date(),
    });
  }

  assertCanDelete(): void {
    if (this.props.status !== "DRAFT") {
      throw new SaleNotDraft();
    }
  }

  applyEdit(input: ApplySaleEditInput): Sale {
    this.assertCurrentNotVoided();
    const next: SaleProps = { ...this.props };
    if (input.date !== undefined) next.date = input.date;
    if (input.description !== undefined) next.description = input.description;
    if (input.contactId !== undefined) next.contactId = input.contactId;
    if ("referenceNumber" in input) {
      next.referenceNumber = input.referenceNumber ?? null;
    }
    if ("notes" in input) next.notes = input.notes ?? null;
    next.updatedAt = new Date();
    return new Sale(next);
  }

  replaceDetails(newDetails: SaleDetail[]): Sale {
    this.assertCurrentNotVoided();
    if (
      newDetails.length === 0 &&
      (this.props.status === "POSTED" || this.props.status === "LOCKED")
    ) {
      throw new SaleNoDetails();
    }
    const totalAmount = newDetails.reduce(
      (sum, d) => sum.plus(d.lineAmount),
      MonetaryAmount.zero(),
    );
    return new Sale({
      ...this.props,
      details: newDetails,
      totalAmount,
      updatedAt: new Date(),
    });
  }

  private assertCurrentNotVoided(): void {
    if (this.props.status === "VOIDED") {
      throw new SaleVoidedImmutable();
    }
  }

  private canTransitionTo(target: SaleStatus): boolean {
    return VALID_TRANSITIONS[this.props.status].includes(target);
  }
}
