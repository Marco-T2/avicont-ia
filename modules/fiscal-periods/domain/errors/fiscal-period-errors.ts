import { ConflictError, ValidationError } from "@/features/shared/errors";

export const FISCAL_PERIOD_MONTH_EXISTS = "FISCAL_PERIOD_MONTH_EXISTS";
export const FISCAL_PERIOD_NOT_MONTHLY = "FISCAL_PERIOD_NOT_MONTHLY";
export const INVALID_DATE_RANGE = "INVALID_DATE_RANGE";
export const INVALID_CALENDAR_MONTH = "INVALID_CALENDAR_MONTH";
export const INVALID_FISCAL_PERIOD_STATUS = "INVALID_FISCAL_PERIOD_STATUS";

export class MonthAlreadyExists extends ConflictError {
  constructor(year: number, month: number, monthName: string) {
    super(
      `período fiscal para ${monthName} de ${year}`,
      FISCAL_PERIOD_MONTH_EXISTS,
      { year, month, monthName },
    );
    this.name = "MonthAlreadyExists";
    // Override the auto-prefixed `${resource} ya existe` message so the wire
    // text matches the legacy service: "Ya existe un período fiscal para Enero de 2026"
    this.message = `Ya existe un período fiscal para ${monthName} de ${year}`;
  }
}

export class NotMonthly extends ValidationError {
  constructor(startDate: Date, endDate: Date) {
    super(
      "El período debe corresponder a exactamente un mes calendario.",
      FISCAL_PERIOD_NOT_MONTHLY,
      { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
    );
    this.name = "NotMonthly";
  }
}

export class InvalidDateRange extends ValidationError {
  constructor() {
    super(
      "La fecha de cierre debe ser posterior a la fecha de apertura",
      INVALID_DATE_RANGE,
    );
    this.name = "InvalidDateRange";
  }
}

export class InvalidCalendarMonth extends ValidationError {
  constructor(message: string) {
    super(message, INVALID_CALENDAR_MONTH);
    this.name = "InvalidCalendarMonth";
  }
}

export class InvalidFiscalPeriodStatus extends ValidationError {
  constructor(value: string) {
    super(
      `Estado de período fiscal inválido: ${value}`,
      INVALID_FISCAL_PERIOD_STATUS,
      { value },
    );
    this.name = "InvalidFiscalPeriodStatus";
  }
}
