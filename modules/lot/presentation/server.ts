import "server-only";

export {
  makeLotService,
  makeLotRepository,
  PrismaLotRepository,
  LocalLotInquiryAdapter,
} from "./composition-root";

export { createLotSchema, closeLotSchema } from "./validation";

export { Lot } from "../domain/lot.entity";
export type {
  LotProps,
  CreateLotInput,
  CloseLotInput,
} from "../domain/lot.entity";
export type {
  LotRepository,
  LotWithRelationsSnapshot,
} from "../domain/lot.repository";
export type { LotStatus } from "../domain/value-objects/lot-status";
export {
  LOT_STATUSES,
  parseLotStatus,
  canTransitionLot,
} from "../domain/value-objects/lot-status";
export { LotSummary } from "../domain/value-objects/lot-summary";
export type { ComputeLotSummaryInput } from "../domain/value-objects/lot-summary";
export {
  LotService,
  type CreateLotServiceInput,
} from "../application/lot.service";
export type {
  LotInquiryPort,
  LotSnapshot,
} from "../domain/ports/lot-inquiry.port";
export {
  InvalidLotStatus,
  InvalidLotStatusTransition,
  CannotCloseInactiveLot,
} from "../domain/errors/lot-errors";
