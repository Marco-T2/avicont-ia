import { LotSummary } from "./value-objects/lot-summary";
import { type LotStatus, canTransitionLot } from "./value-objects/lot-status";
import {
  CannotDeactivateInactiveLot,
  LotCannotUpdateInactive,
} from "./errors/lot-errors";

export interface LotProps {
  id: string;
  name: string;
  barnNumber: number;
  initialCount: number;
  startDate: Date;
  endDate: Date | null;
  status: LotStatus;
  farmName: string;
  memberId: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLotInput {
  name: string;
  barnNumber: number;
  initialCount: number;
  startDate: Date;
  farmName: string;
  memberId: string;
  organizationId: string;
}

export interface DeactivateLotInput {
  endDate: Date;
}

/** @deprecated Use DeactivateLotInput post-collapse (REQ-203, D-4). */
export type CloseLotInput = DeactivateLotInput;

export interface UpdateLotInput {
  name?: string;
  barnNumber?: number;
  farmName?: string;
}

export interface LotSnapshot {
  id: string;
  name: string;
  barnNumber: number;
  initialCount: number;
  startDate: Date;
  endDate: Date | null;
  status: LotStatus;
  farmName: string;
  memberId: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Lot {
  private constructor(private readonly props: LotProps) {}

  static create(input: CreateLotInput): Lot {
    const now = new Date();
    return new Lot({
      id: crypto.randomUUID(),
      name: input.name,
      barnNumber: input.barnNumber,
      initialCount: input.initialCount,
      startDate: input.startDate,
      endDate: null,
      status: "ACTIVE",
      farmName: input.farmName,
      memberId: input.memberId,
      organizationId: input.organizationId,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: LotProps): Lot {
    return new Lot(props);
  }

  get id(): string { return this.props.id; }
  get name(): string { return this.props.name; }
  get barnNumber(): number { return this.props.barnNumber; }
  get initialCount(): number { return this.props.initialCount; }
  get startDate(): Date { return this.props.startDate; }
  get endDate(): Date | null { return this.props.endDate; }
  get status(): LotStatus { return this.props.status; }
  get farmName(): string { return this.props.farmName; }
  get memberId(): string { return this.props.memberId; }
  get organizationId(): string { return this.props.organizationId; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  /**
   * Transitions an ACTIVE lot to INACTIVE with the given endDate.
   * Replaces the legacy `close(endDate)` API; the rename aligns with
   * the user-language verb "desactivar" (REQ-203, D-4 step 2/3).
   */
  deactivate(endDate: Date): Lot {
    if (!canTransitionLot(this.props.status, "INACTIVE")) {
      throw new CannotDeactivateInactiveLot();
    }
    return new Lot({
      ...this.props,
      status: "INACTIVE",
      endDate,
      updatedAt: new Date(),
    });
  }

  /**
   * Returns a new Lot with updated `name`, `barnNumber`, and/or
   * `farmName`. Other fields (id, initialCount, status, memberId,
   * organizationId, createdAt) are immutable post-creation (INV-04).
   * `updatedAt` advances on every call. Throws LotCannotUpdateInactive
   * when the lot is not ACTIVE (INACTIVE lots are historical snapshots).
   * Spec REQ-100, INV-04 (farmName mutable).
   */
  update(input: UpdateLotInput): Lot {
    if (this.props.status !== "ACTIVE") {
      throw new LotCannotUpdateInactive(this.props.id);
    }
    return new Lot({
      ...this.props,
      name: input.name ?? this.props.name,
      barnNumber: input.barnNumber ?? this.props.barnNumber,
      farmName: input.farmName ?? this.props.farmName,
      updatedAt: new Date(),
    });
  }

  toSnapshot(): LotSnapshot {
    return {
      id: this.props.id,
      name: this.props.name,
      barnNumber: this.props.barnNumber,
      initialCount: this.props.initialCount,
      startDate: this.props.startDate,
      endDate: this.props.endDate,
      status: this.props.status,
      farmName: this.props.farmName,
      memberId: this.props.memberId,
      organizationId: this.props.organizationId,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }

  computeSummary(
    expenses: { amount: number }[],
    mortalityLogs: { count: number }[],
  ): LotSummary {
    return LotSummary.compute({
      initialCount: this.props.initialCount,
      expenses,
      mortalityLogs,
    });
  }
}
