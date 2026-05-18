import "server-only";

export {
  makeLotService,
  makeLotRepository,
  PrismaLotRepository,
  LocalLotInquiryAdapter,
} from "./composition-root";

export {
  createLotSchema,
  deactivateLotSchema,
  closeLotSchema,
  updateLotSchema,
} from "./validation";

export { Lot } from "../domain/lot.entity";
export type {
  LotProps,
  CreateLotInput,
  DeactivateLotInput,
  CloseLotInput,
  UpdateLotInput,
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
import type { LotSummary as _LotSummaryType } from "../domain/value-objects/lot-summary";
export type { ComputeLotSummaryInput } from "../domain/value-objects/lot-summary";
export type LotSummaryShape = ReturnType<_LotSummaryType["toJSON"]>;
export {
  LotService,
  type CreateLotServiceInput,
  type UpdateLotServiceInput,
  type DeactivateLotServiceInput,
  type CloseLotServiceInput,
} from "../application/lot.service";
export type {
  LotInquiryPort,
  LotSnapshot,
} from "../domain/ports/lot-inquiry.port";
export {
  InvalidLotStatus,
  InvalidLotStatusTransition,
  CannotDeactivateInactiveLot,
  LotForFarmAtDateExists,
  LotCannotUpdateInactive,
} from "../domain/errors/lot-errors";
