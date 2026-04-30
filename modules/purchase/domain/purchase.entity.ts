import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import type { PurchaseStatus } from "./value-objects/purchase-status";
import { PurchaseDetail } from "./purchase-detail.entity";
import type { PayableSummary } from "./value-objects/payable-summary";
import {
  PurchaseNoDetails,
  PurchaseNotDraft,
  InvalidPurchaseStatusTransition,
  PurchaseVoidedImmutable,
  PurchaseExpenseAccountsRequired,
} from "./errors/purchase-errors";

export type PurchaseType = "FLETE" | "POLLO_FAENADO" | "COMPRA_GENERAL" | "SERVICIO";

const VALID_TRANSITIONS: Record<PurchaseStatus, PurchaseStatus[]> = {
  DRAFT: ["POSTED"],
  POSTED: ["LOCKED", "VOIDED"],
  LOCKED: ["VOIDED"],
  VOIDED: [],
};

export interface PurchaseProps {
  id: string;
  organizationId: string;
  purchaseType: PurchaseType;
  status: PurchaseStatus;
  sequenceNumber: number | null;
  date: Date;
  contactId: string;
  periodId: string;
  description: string;
  referenceNumber: number | null;
  notes: string | null;
  totalAmount: MonetaryAmount;
  ruta: string | null;
  farmOrigin: string | null;
  chickenCount: number | null;
  shrinkagePct: number | null;
  totalGrossKg: number | null;
  totalNetKg: number | null;
  totalShrinkKg: number | null;
  totalShortageKg: number | null;
  totalRealNetKg: number | null;
  journalEntryId: string | null;
  payableId: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  details: PurchaseDetail[];
  payable: PayableSummary | null;
}

export interface CreatePurchaseDraftDetailInput {
  description: string;
  lineAmount: MonetaryAmount;
  order?: number;
  quantity?: number;
  unitPrice?: number;
  expenseAccountId?: string;
  fecha?: Date;
  docRef?: string;
  chickenQty?: number;
  pricePerChicken?: number;
  productTypeId?: string;
  detailNote?: string;
  boxes?: number;
  grossWeight?: number;
  tare?: number;
  netWeight?: number;
  shrinkage?: number;
  shortage?: number;
  realNetWeight?: number;
}

export interface CreatePurchaseDraftInput {
  organizationId: string;
  purchaseType: PurchaseType;
  contactId: string;
  periodId: string;
  date: Date;
  description: string;
  createdById: string;
  referenceNumber?: number;
  notes?: string;
  ruta?: string;
  farmOrigin?: string;
  chickenCount?: number;
  shrinkagePct?: number;
  totalGrossKg?: number;
  totalNetKg?: number;
  totalShrinkKg?: number;
  totalShortageKg?: number;
  totalRealNetKg?: number;
  details: CreatePurchaseDraftDetailInput[];
}

export interface ApplyPurchaseEditInput {
  date?: Date;
  description?: string;
  contactId?: string;
  referenceNumber?: number | null;
  notes?: string | null;
  ruta?: string | null;
  farmOrigin?: string | null;
  chickenCount?: number | null;
  shrinkagePct?: number | null;
}

export class Purchase {
  private constructor(private readonly props: PurchaseProps) {}

  static createDraft(input: CreatePurchaseDraftInput): Purchase {
    const id = crypto.randomUUID();
    const now = new Date();
    const details = input.details.map((d, idx) =>
      PurchaseDetail.create({
        purchaseId: id,
        description: d.description,
        lineAmount: d.lineAmount,
        order: d.order ?? idx,
        quantity: d.quantity,
        unitPrice: d.unitPrice,
        expenseAccountId: d.expenseAccountId,
        fecha: d.fecha,
        docRef: d.docRef,
        chickenQty: d.chickenQty,
        pricePerChicken: d.pricePerChicken,
        productTypeId: d.productTypeId,
        detailNote: d.detailNote,
        boxes: d.boxes,
        grossWeight: d.grossWeight,
        tare: d.tare,
        netWeight: d.netWeight,
        shrinkage: d.shrinkage,
        shortage: d.shortage,
        realNetWeight: d.realNetWeight,
      }),
    );
    const totalAmount = details.reduce(
      (sum, d) => sum.plus(d.lineAmount),
      MonetaryAmount.zero(),
    );
    return new Purchase({
      id,
      organizationId: input.organizationId,
      purchaseType: input.purchaseType,
      status: "DRAFT",
      sequenceNumber: null,
      date: input.date,
      contactId: input.contactId,
      periodId: input.periodId,
      description: input.description,
      referenceNumber: input.referenceNumber ?? null,
      notes: input.notes ?? null,
      totalAmount,
      ruta: input.ruta ?? null,
      farmOrigin: input.farmOrigin ?? null,
      chickenCount: input.chickenCount ?? null,
      shrinkagePct: input.shrinkagePct ?? null,
      totalGrossKg: input.totalGrossKg ?? null,
      totalNetKg: input.totalNetKg ?? null,
      totalShrinkKg: input.totalShrinkKg ?? null,
      totalShortageKg: input.totalShortageKg ?? null,
      totalRealNetKg: input.totalRealNetKg ?? null,
      journalEntryId: null,
      payableId: null,
      createdById: input.createdById,
      createdAt: now,
      updatedAt: now,
      details,
      payable: null,
    });
  }

  static fromPersistence(props: PurchaseProps): Purchase {
    return new Purchase(props);
  }

  assignSequenceNumber(sequenceNumber: number): Purchase {
    return new Purchase({ ...this.props, sequenceNumber, updatedAt: new Date() });
  }

  linkJournal(journalEntryId: string): Purchase {
    return new Purchase({ ...this.props, journalEntryId, updatedAt: new Date() });
  }

  linkPayable(payableId: string): Purchase {
    return new Purchase({ ...this.props, payableId, updatedAt: new Date() });
  }

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get purchaseType(): PurchaseType {
    return this.props.purchaseType;
  }
  get status(): PurchaseStatus {
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
  get ruta(): string | null {
    return this.props.ruta;
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
  get journalEntryId(): string | null {
    return this.props.journalEntryId;
  }
  get payableId(): string | null {
    return this.props.payableId;
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
  get details(): PurchaseDetail[] {
    return [...this.props.details];
  }
  get payable(): PayableSummary | null {
    return this.props.payable;
  }

  post(): Purchase {
    this.assertCurrentNotVoided();
    if (!this.canTransitionTo("POSTED")) {
      throw new InvalidPurchaseStatusTransition(this.props.status, "POSTED");
    }
    if (this.props.details.length === 0) {
      throw new PurchaseNoDetails();
    }
    this.assertExpenseAccountsSetForType(this.props.details);
    const totalAmount = this.props.details.reduce(
      (sum, d) => sum.plus(d.lineAmount),
      MonetaryAmount.zero(),
    );
    return new Purchase({
      ...this.props,
      status: "POSTED",
      totalAmount,
      updatedAt: new Date(),
    });
  }

  void(): Purchase {
    this.assertCurrentNotVoided();
    if (!this.canTransitionTo("VOIDED")) {
      throw new InvalidPurchaseStatusTransition(this.props.status, "VOIDED");
    }
    return new Purchase({
      ...this.props,
      status: "VOIDED",
      updatedAt: new Date(),
    });
  }

  lock(): Purchase {
    this.assertCurrentNotVoided();
    if (!this.canTransitionTo("LOCKED")) {
      throw new InvalidPurchaseStatusTransition(this.props.status, "LOCKED");
    }
    return new Purchase({
      ...this.props,
      status: "LOCKED",
      updatedAt: new Date(),
    });
  }

  assertCanDelete(): void {
    if (this.props.status !== "DRAFT") {
      throw new PurchaseNotDraft();
    }
  }

  applyEdit(input: ApplyPurchaseEditInput): Purchase {
    this.assertCurrentNotVoided();
    const next: PurchaseProps = { ...this.props };
    if (input.date !== undefined) next.date = input.date;
    if (input.description !== undefined) next.description = input.description;
    if (input.contactId !== undefined) next.contactId = input.contactId;
    if ("referenceNumber" in input) {
      next.referenceNumber = input.referenceNumber ?? null;
    }
    if ("notes" in input) next.notes = input.notes ?? null;
    if ("ruta" in input) next.ruta = input.ruta ?? null;
    if ("farmOrigin" in input) next.farmOrigin = input.farmOrigin ?? null;
    if ("chickenCount" in input) next.chickenCount = input.chickenCount ?? null;
    if ("shrinkagePct" in input) next.shrinkagePct = input.shrinkagePct ?? null;
    next.updatedAt = new Date();
    return new Purchase(next);
  }

  replaceDetails(newDetails: PurchaseDetail[]): Purchase {
    this.assertCurrentNotVoided();
    if (
      newDetails.length === 0 &&
      (this.props.status === "POSTED" || this.props.status === "LOCKED")
    ) {
      throw new PurchaseNoDetails();
    }
    if (newDetails.length > 0) {
      this.assertExpenseAccountsSetForType(newDetails);
    }
    const totalAmount = newDetails.reduce(
      (sum, d) => sum.plus(d.lineAmount),
      MonetaryAmount.zero(),
    );
    return new Purchase({
      ...this.props,
      details: newDetails,
      totalAmount,
      updatedAt: new Date(),
    });
  }

  private assertCurrentNotVoided(): void {
    if (this.props.status === "VOIDED") {
      throw new PurchaseVoidedImmutable();
    }
  }

  private canTransitionTo(target: PurchaseStatus): boolean {
    return VALID_TRANSITIONS[this.props.status].includes(target);
  }

  private assertExpenseAccountsSetForType(details: PurchaseDetail[]): void {
    if (
      this.props.purchaseType !== "COMPRA_GENERAL" &&
      this.props.purchaseType !== "SERVICIO"
    ) {
      return;
    }
    for (const d of details) {
      if (!d.expenseAccountId) {
        throw new PurchaseExpenseAccountsRequired();
      }
    }
  }
}
