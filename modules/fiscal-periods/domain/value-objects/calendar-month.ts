import { InvalidCalendarMonth } from "../errors/fiscal-period-errors";

export class CalendarMonth {
  private constructor(
    public readonly year: number,
    public readonly month: number,
  ) {}

  static of(year: number, month: number): CalendarMonth {
    if (!Number.isInteger(year)) {
      throw new InvalidCalendarMonth("El año debe ser un número entero");
    }
    if (!Number.isInteger(month)) {
      throw new InvalidCalendarMonth("El mes debe ser un número entero");
    }
    if (month < 1 || month > 12) {
      throw new InvalidCalendarMonth(`Mes fuera de rango (1..12): ${month}`);
    }
    return new CalendarMonth(year, month);
  }

  static fromDate(date: Date): CalendarMonth {
    return CalendarMonth.of(date.getUTCFullYear(), date.getUTCMonth() + 1);
  }

  equals(other: CalendarMonth): boolean {
    return this.year === other.year && this.month === other.month;
  }
}
