import { CalendarMonth } from "./value-objects/calendar-month";
import { FiscalPeriodStatus } from "./value-objects/fiscal-period-status";
import { MonthlyRange } from "./value-objects/monthly-range";

export interface FiscalPeriodProps {
  id: string;
  organizationId: string;
  name: string;
  range: MonthlyRange;
  status: FiscalPeriodStatus;
  closedAt: Date | null;
  closedBy: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFiscalPeriodInput {
  name: string;
  year: number;
  startDate: Date;
  endDate: Date;
  createdById: string;
  organizationId: string;
}

export interface FiscalPeriodSnapshot {
  id: string;
  organizationId: string;
  name: string;
  year: number;
  month: number;
  startDate: Date;
  endDate: Date;
  status: "OPEN" | "CLOSED";
  closedAt: Date | null;
  closedBy: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export class FiscalPeriod {
  private constructor(private readonly props: FiscalPeriodProps) {}

  static create(input: CreateFiscalPeriodInput): FiscalPeriod {
    const range = MonthlyRange.of(input.startDate, input.endDate);
    const now = new Date();
    return new FiscalPeriod({
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      name: input.name,
      range,
      status: FiscalPeriodStatus.open(),
      closedAt: null,
      closedBy: null,
      createdById: input.createdById,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: FiscalPeriodProps): FiscalPeriod {
    return new FiscalPeriod(props);
  }

  get id(): string { return this.props.id; }
  get organizationId(): string { return this.props.organizationId; }
  get name(): string { return this.props.name; }
  get range(): MonthlyRange { return this.props.range; }
  get calendarMonth(): CalendarMonth { return this.props.range.calendarMonth; }
  get year(): number { return this.props.range.calendarMonth.year; }
  get month(): number { return this.props.range.calendarMonth.month; }
  get startDate(): Date { return this.props.range.startDate; }
  get endDate(): Date { return this.props.range.endDate; }
  get status(): FiscalPeriodStatus { return this.props.status; }
  get closedAt(): Date | null { return this.props.closedAt; }
  get closedBy(): string | null { return this.props.closedBy; }
  get createdById(): string { return this.props.createdById; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  isOpen(): boolean {
    return this.props.status.isOpen();
  }

  isCovering(date: Date | string): boolean {
    return this.isOpen() && this.props.range.contains(date);
  }

  toSnapshot(): FiscalPeriodSnapshot {
    return {
      id: this.props.id,
      organizationId: this.props.organizationId,
      name: this.props.name,
      year: this.year,
      month: this.month,
      startDate: this.props.range.startDate,
      endDate: this.props.range.endDate,
      status: this.props.status.value,
      closedAt: this.props.closedAt,
      closedBy: this.props.closedBy,
      createdById: this.props.createdById,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
