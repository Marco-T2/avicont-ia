// Isomorphic barrel — safe for client and server consumers. Anything that
// requires server-only state (Prisma, composition root) lives in `./server`.

export { MONTH_NAMES_ES, monthNameEs } from "../domain/month-names";
export { createFiscalPeriodSchema } from "./fiscal-period.validation";
export {
  findPeriodCoveringDate,
  type FiscalPeriodLike,
} from "../domain/fiscal-period-finder";
export type { FiscalPeriodSnapshot as FiscalPeriod } from "../domain/fiscal-period.entity";
