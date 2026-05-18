import { formatDateBO } from "@/lib/date-utils";
import { LotSummary } from "./value-objects/lot-summary";
import { type LotStatus, canTransitionLot } from "./value-objects/lot-status";
import {
  CannotDeactivateInactiveLot,
  LotCannotUpdateInactive,
} from "./errors/lot-errors";

export interface LotProps {
  id: string;
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
  farmName?: string;
}

export interface LotSnapshot {
  id: string;
  initialCount: number;
  startDate: Date;
  endDate: Date | null;
  status: LotStatus;
  farmName: string;
  /**
   * Pre-computed identifier used by every consumer (UI/AI agent/PDF).
   * Format: "{farmName} - DD/MM/YYYY" derived from `farmName + startDate`
   * via `formatDateBO`. Marco-locked simplification (apply-directo
   * simplify-lot-identifier): the bare `name` column is gone, the lot
   * is uniquely identified by farmName + startDate (DB-level @@unique).
   */
  displayName: string;
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
  get initialCount(): number { return this.props.initialCount; }
  get startDate(): Date { return this.props.startDate; }
  get endDate(): Date | null { return this.props.endDate; }
  get status(): LotStatus { return this.props.status; }
  get farmName(): string { return this.props.farmName; }
  /**
   * Computed identifier: "{farmName} - DD/MM/YYYY" (formatDateBO).
   * Replaces the dropped `name` column. Format is stable across
   * server/client because formatDateBO uses the ISO-prefix slice
   * (no Intl runtime), so it never depends on TZ/locale at format
   * time. Marco's verbatim simplification rule: "se puede crear el
   * nombre 'Granja Vinto - 17/05/2026' jalando la fecha de inicio
   * así nunca se tendrá 2 del mismo".
   */
  get displayName(): string {
    return `${this.props.farmName} - ${formatDateBO(this.props.startDate)}`;
  }
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
   * Returns a new Lot with updated `farmName`. Other fields (id,
   * initialCount, startDate, status, memberId, organizationId,
   * createdAt) are immutable post-creation (INV-04). Note: startDate
   * is immutable post simplify-lot-identifier — changing it would
   * mutate displayName silently, breaking the (farmName, startDate)
   * DB unique invariant Marco locked. `updatedAt` advances on every
   * call. Throws LotCannotUpdateInactive when the lot is not ACTIVE.
   * Spec REQ-100, INV-04 (farmName mutable).
   */
  update(input: UpdateLotInput): Lot {
    if (this.props.status !== "ACTIVE") {
      throw new LotCannotUpdateInactive(this.props.id);
    }
    return new Lot({
      ...this.props,
      farmName: input.farmName ?? this.props.farmName,
      updatedAt: new Date(),
    });
  }

  toSnapshot(): LotSnapshot {
    return {
      id: this.props.id,
      initialCount: this.props.initialCount,
      startDate: this.props.startDate,
      endDate: this.props.endDate,
      status: this.props.status,
      farmName: this.props.farmName,
      displayName: this.displayName,
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
