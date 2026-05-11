import type { DispatchStatus } from "./value-objects/dispatch-status";
import type { DispatchType } from "./value-objects/dispatch-type";
import { DispatchDetail } from "./dispatch-detail.entity";
import type { ReceivableSummary } from "./value-objects/receivable-summary";
import {
  DispatchNoDetails,
  DispatchNotDraft,
  InvalidDispatchStatusTransition,
  DispatchVoidedImmutable,
} from "./errors/dispatch-errors";

const VALID_TRANSITIONS: Record<DispatchStatus, DispatchStatus[]> = {
  DRAFT: ["POSTED"],
  POSTED: ["LOCKED", "VOIDED"],
  LOCKED: ["VOIDED"],
  VOIDED: [],
};

export interface DispatchProps {
  id: string;
  organizationId: string;
  dispatchType: DispatchType;
  status: DispatchStatus;
  sequenceNumber: number;
  date: Date;
  contactId: string;
  periodId: string;
  description: string;
  referenceNumber: number | null;
  notes: string | null;
  totalAmount: number;
  journalEntryId: string | null;
  receivableId: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  details: DispatchDetail[];
  receivable: ReceivableSummary | null;
  // BC-specific header fields
  farmOrigin: string | null;
  chickenCount: number | null;
  shrinkagePct: number | null;
  avgKgPerChicken: number | null;
  totalGrossKg: number | null;
  totalNetKg: number | null;
  totalShrinkKg: number | null;
  totalShortageKg: number | null;
  totalRealNetKg: number | null;
}

export interface CreateDispatchDraftInput {
  organizationId: string;
  dispatchType: DispatchType;
  contactId: string;
  periodId: string;
  date: Date;
  description: string;
  createdById: string;
  referenceNumber?: number;
  notes?: string;
  farmOrigin?: string;
  chickenCount?: number;
  shrinkagePct?: number;
  details: Omit<import("./dispatch-detail.entity").CreateDispatchDetailInput, "dispatchId">[];
}

export interface ApplyDispatchEditInput {
  date?: Date;
  description?: string;
  contactId?: string;
  referenceNumber?: number | null;
  notes?: string | null;
  farmOrigin?: string | null;
  chickenCount?: number | null;
  shrinkagePct?: number | null;
}

export class Dispatch {
  private constructor(private readonly props: DispatchProps) {}

  static createDraft(input: CreateDispatchDraftInput): Dispatch {
    const id = crypto.randomUUID();
    const now = new Date();
    const details = input.details.map((d, idx) =>
      DispatchDetail.create({
        dispatchId: id,
        description: d.description,
        boxes: d.boxes,
        grossWeight: d.grossWeight,
        tare: d.tare,
        netWeight: d.netWeight,
        unitPrice: d.unitPrice,
        lineAmount: d.lineAmount,
        order: d.order ?? idx,
        productTypeId: d.productTypeId,
        detailNote: d.detailNote,
        shrinkage: d.shrinkage,
        shortage: d.shortage,
        realNetWeight: d.realNetWeight,
      }),
    );
    return new Dispatch({
      id,
      organizationId: input.organizationId,
      dispatchType: input.dispatchType,
      status: "DRAFT",
      sequenceNumber: 0,
      date: input.date,
      contactId: input.contactId,
      periodId: input.periodId,
      description: input.description,
      referenceNumber: input.referenceNumber ?? null,
      notes: input.notes ?? null,
      totalAmount: 0,
      journalEntryId: null,
      receivableId: null,
      createdById: input.createdById,
      createdAt: now,
      updatedAt: now,
      details,
      receivable: null,
      farmOrigin: input.farmOrigin ?? null,
      chickenCount: input.chickenCount ?? null,
      shrinkagePct: input.shrinkagePct ?? null,
      avgKgPerChicken: null,
      totalGrossKg: null,
      totalNetKg: null,
      totalShrinkKg: null,
      totalShortageKg: null,
      totalRealNetKg: null,
    });
  }

  static fromPersistence(props: DispatchProps): Dispatch {
    return new Dispatch(props);
  }

  assignSequenceNumber(sequenceNumber: number): Dispatch {
    return new Dispatch({ ...this.props, sequenceNumber, updatedAt: new Date() });
  }

  linkJournal(journalEntryId: string): Dispatch {
    return new Dispatch({ ...this.props, journalEntryId, updatedAt: new Date() });
  }

  linkReceivable(receivableId: string): Dispatch {
    return new Dispatch({ ...this.props, receivableId, updatedAt: new Date() });
  }

  setTotalAmount(totalAmount: number): Dispatch {
    return new Dispatch({ ...this.props, totalAmount, updatedAt: new Date() });
  }

  setBcSummary(summary: {
    avgKgPerChicken: number;
    totalGrossKg: number;
    totalNetKg: number;
    totalShrinkKg: number;
    totalShortageKg: number;
    totalRealNetKg: number;
  }): Dispatch {
    return new Dispatch({
      ...this.props,
      avgKgPerChicken: summary.avgKgPerChicken,
      totalGrossKg: summary.totalGrossKg,
      totalNetKg: summary.totalNetKg,
      totalShrinkKg: summary.totalShrinkKg,
      totalShortageKg: summary.totalShortageKg,
      totalRealNetKg: summary.totalRealNetKg,
      updatedAt: new Date(),
    });
  }

  // ── Getters ──────────────────────────────────────────────────────────────

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get dispatchType(): DispatchType {
    return this.props.dispatchType;
  }
  get status(): DispatchStatus {
    return this.props.status;
  }
  get sequenceNumber(): number {
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
  get totalAmount(): number {
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
  get details(): DispatchDetail[] {
    return [...this.props.details];
  }
  get receivable(): ReceivableSummary | null {
    return this.props.receivable;
  }
  get farmOrigin(): string | null {
    return this.props.farmOrigin;
  }
  get chickenCount(): number | null {
    return this.props.chickenCount;
  }
  get shrinkagePct(): number | null {
    return this.props.shrinkagePct;
  }
  get avgKgPerChicken(): number | null {
    return this.props.avgKgPerChicken;
  }
  get totalGrossKg(): number | null {
    return this.props.totalGrossKg;
  }
  get totalNetKg(): number | null {
    return this.props.totalNetKg;
  }
  get totalShrinkKg(): number | null {
    return this.props.totalShrinkKg;
  }
  get totalShortageKg(): number | null {
    return this.props.totalShortageKg;
  }
  get totalRealNetKg(): number | null {
    return this.props.totalRealNetKg;
  }

  // ── State Machine ────────────────────────────────────────────────────────

  post(): Dispatch {
    this.assertCurrentNotVoided();
    if (!this.canTransitionTo("POSTED")) {
      throw new InvalidDispatchStatusTransition(this.props.status, "POSTED");
    }
    if (this.props.details.length === 0) {
      throw new DispatchNoDetails();
    }
    return new Dispatch({
      ...this.props,
      status: "POSTED",
      updatedAt: new Date(),
    });
  }

  void(): Dispatch {
    this.assertCurrentNotVoided();
    if (!this.canTransitionTo("VOIDED")) {
      throw new InvalidDispatchStatusTransition(this.props.status, "VOIDED");
    }
    return new Dispatch({
      ...this.props,
      status: "VOIDED",
      updatedAt: new Date(),
    });
  }

  lock(): Dispatch {
    this.assertCurrentNotVoided();
    if (!this.canTransitionTo("LOCKED")) {
      throw new InvalidDispatchStatusTransition(this.props.status, "LOCKED");
    }
    return new Dispatch({
      ...this.props,
      status: "LOCKED",
      updatedAt: new Date(),
    });
  }

  assertCanDelete(): void {
    if (this.props.status !== "DRAFT") {
      throw new DispatchNotDraft();
    }
  }

  applyEdit(input: ApplyDispatchEditInput): Dispatch {
    this.assertCurrentNotVoided();
    const next: DispatchProps = { ...this.props };
    if (input.date !== undefined) next.date = input.date;
    if (input.description !== undefined) next.description = input.description;
    if (input.contactId !== undefined) next.contactId = input.contactId;
    if ("referenceNumber" in input) {
      next.referenceNumber = input.referenceNumber ?? null;
    }
    if ("notes" in input) next.notes = input.notes ?? null;
    if ("farmOrigin" in input) next.farmOrigin = input.farmOrigin ?? null;
    if ("chickenCount" in input) next.chickenCount = input.chickenCount ?? null;
    if ("shrinkagePct" in input) next.shrinkagePct = input.shrinkagePct ?? null;
    next.updatedAt = new Date();
    return new Dispatch(next);
  }

  replaceDetails(newDetails: DispatchDetail[]): Dispatch {
    this.assertCurrentNotVoided();
    if (
      newDetails.length === 0 &&
      (this.props.status === "POSTED" || this.props.status === "LOCKED")
    ) {
      throw new DispatchNoDetails();
    }
    return new Dispatch({
      ...this.props,
      details: newDetails,
      updatedAt: new Date(),
    });
  }

  private assertCurrentNotVoided(): void {
    if (this.props.status === "VOIDED") {
      throw new DispatchVoidedImmutable();
    }
  }

  private canTransitionTo(target: DispatchStatus): boolean {
    return VALID_TRANSITIONS[this.props.status].includes(target);
  }
}
