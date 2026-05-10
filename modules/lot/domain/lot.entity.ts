import { LotSummary } from "./value-objects/lot-summary";
import { type LotStatus, canTransitionLot } from "./value-objects/lot-status";
import { CannotCloseInactiveLot } from "./errors/lot-errors";

export interface LotProps {
  id: string;
  name: string;
  barnNumber: number;
  initialCount: number;
  startDate: Date;
  endDate: Date | null;
  status: LotStatus;
  farmId: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLotInput {
  name: string;
  barnNumber: number;
  initialCount: number;
  startDate: Date;
  farmId: string;
  organizationId: string;
}

export interface CloseLotInput {
  endDate: Date;
}

export interface LotSnapshot {
  id: string;
  name: string;
  barnNumber: number;
  initialCount: number;
  startDate: Date;
  endDate: Date | null;
  status: LotStatus;
  farmId: string;
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
      farmId: input.farmId,
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
  get farmId(): string { return this.props.farmId; }
  get organizationId(): string { return this.props.organizationId; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  close(endDate: Date): Lot {
    if (!canTransitionLot(this.props.status, "CLOSED")) {
      throw new CannotCloseInactiveLot();
    }
    return new Lot({
      ...this.props,
      status: "CLOSED",
      endDate,
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
      farmId: this.props.farmId,
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
