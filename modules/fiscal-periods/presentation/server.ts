import "server-only";

export { makeFiscalPeriodsService } from "./composition-root";
export { createFiscalPeriodSchema } from "./fiscal-period.validation";

// Domain re-exports for server callers (entity, VOs, errors, port).
export { FiscalPeriod } from "../domain/fiscal-period.entity";
export type {
  FiscalPeriodProps,
  FiscalPeriodSnapshot,
  CreateFiscalPeriodInput,
} from "../domain/fiscal-period.entity";
export { FiscalPeriodStatus } from "../domain/value-objects/fiscal-period-status";
export type { FiscalPeriodStatusValue } from "../domain/value-objects/fiscal-period-status";
export { MonthlyRange } from "../domain/value-objects/monthly-range";
export { CalendarMonth } from "../domain/value-objects/calendar-month";
export type { FiscalPeriodRepository } from "../domain/fiscal-period.repository";
export {
  MonthAlreadyExists,
  NotMonthly,
  InvalidDateRange,
  InvalidCalendarMonth,
  InvalidFiscalPeriodStatus,
  FISCAL_PERIOD_MONTH_EXISTS,
  FISCAL_PERIOD_NOT_MONTHLY,
  INVALID_DATE_RANGE,
  INVALID_CALENDAR_MONTH,
  INVALID_FISCAL_PERIOD_STATUS,
} from "../domain/errors/fiscal-period-errors";
