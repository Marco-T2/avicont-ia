import { FiscalYearAlreadyClosedError } from "./errors/annual-close-errors";
import { FiscalYearStatus } from "./value-objects/fiscal-year-status";
import { Year } from "./value-objects/year";

/**
 * FiscalYear aggregate — the annual-close root.
 *
 * Spec REQ-1.1 + REQ-1.2; design rev 2 §3. Mirrors `FiscalPeriod` skeleton
 * (private ctor + `create` / `fromPersistence` + `toSnapshot`). Hexagonal
 * layer 1 — pure TS, no infra imports.
 *
 * Persistence shape (`FiscalYearSnapshot`) unwraps the year VO to int and
 * status VO to literal so adapters can pass it straight to Prisma.
 *
 * **CAN-5.6 — FK retirement (annual-close-canonical-flow)**: the legacy
 * 1:1 FK columns `closingEntryId` / `openingEntryId` are RETIRED. The
 * 5-asientos canonical flow emits up to 4 CC + 1 CA per FY; the link is
 * now reverse-lookup via `JournalEntry.sourceType='annual-close' AND
 * sourceId=FiscalYear.id`. JSDoc atomic revoke applied in the same commit
 * as the schema drop.
 */

export interface FiscalYearProps {
  id: string;
  organizationId: string;
  year: Year;
  status: FiscalYearStatus;
  closedAt: Date | null;
  closedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFiscalYearInput {
  organizationId: string;
  year: Year;
  createdById: string;
}

export interface MarkClosedInput {
  closedBy: string;
}

export interface FiscalYearSnapshot {
  id: string;
  organizationId: string;
  year: number;
  status: "OPEN" | "CLOSED";
  closedAt: Date | null;
  closedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class FiscalYear {
  private constructor(private readonly props: FiscalYearProps) {}

  static create(input: CreateFiscalYearInput): FiscalYear {
    const now = new Date();
    return new FiscalYear({
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      year: input.year,
      status: FiscalYearStatus.open(),
      closedAt: null,
      closedBy: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: FiscalYearProps): FiscalYear {
    return new FiscalYear(props);
  }

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get year(): Year {
    return this.props.year;
  }
  get status(): FiscalYearStatus {
    return this.props.status;
  }
  get closedAt(): Date | null {
    return this.props.closedAt;
  }
  get closedBy(): string | null {
    return this.props.closedBy;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isOpen(): boolean {
    return this.props.status.isOpen();
  }

  isClosed(): boolean {
    return this.props.status.isClosed();
  }

  /**
   * OPEN → CLOSED transition. Sets all close-bookkeeping fields atomically
   * and stamps `closedAt` / `updatedAt`. Throws `FiscalYearAlreadyClosedError`
   * if already CLOSED (W-3 in-aggregate guard; the adapter layer mirrors
   * this via the affected-rows=1 check on the guarded UPDATE).
   *
   * Returns a NEW FiscalYear instance — props are read-only.
   */
  markClosed(input: MarkClosedInput): FiscalYear {
    if (this.props.status.isClosed()) {
      throw new FiscalYearAlreadyClosedError({ fiscalYearId: this.props.id });
    }
    const now = new Date();
    return new FiscalYear({
      ...this.props,
      status: FiscalYearStatus.closed(),
      closedAt: now,
      closedBy: input.closedBy,
      updatedAt: now,
    });
  }

  toSnapshot(): FiscalYearSnapshot {
    return {
      id: this.props.id,
      organizationId: this.props.organizationId,
      year: this.props.year.value,
      status: this.props.status.value,
      closedAt: this.props.closedAt,
      closedBy: this.props.closedBy,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
