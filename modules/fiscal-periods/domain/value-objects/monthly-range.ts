import { lastDayOfUTCMonth } from "@/lib/date-utils";
import {
  InvalidDateRange,
  NotMonthly,
} from "../errors/fiscal-period-errors";
import { CalendarMonth } from "./calendar-month";

function toIsoDateSlice(value: Date | string): string {
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

export class MonthlyRange {
  private constructor(
    public readonly startDate: Date,
    public readonly endDate: Date,
  ) {}

  static of(startDate: Date, endDate: Date): MonthlyRange {
    if (endDate.getTime() <= startDate.getTime()) {
      throw new InvalidDateRange();
    }
    const isFirstDay = startDate.getUTCDate() === 1;
    const isLastDay =
      endDate.getTime() === lastDayOfUTCMonth(startDate).getTime();
    if (!isFirstDay || !isLastDay) {
      throw new NotMonthly(startDate, endDate);
    }
    return new MonthlyRange(startDate, endDate);
  }

  get calendarMonth(): CalendarMonth {
    return CalendarMonth.fromDate(this.startDate);
  }

  contains(date: Date | string): boolean {
    const target = toIsoDateSlice(date);
    return (
      toIsoDateSlice(this.startDate) <= target &&
      target <= toIsoDateSlice(this.endDate)
    );
  }
}
