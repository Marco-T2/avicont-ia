import "server-only";

export { makeMortalityService } from "./composition-root";
export { logMortalitySchema } from "./mortality.validation";
export { Mortality } from "../domain/mortality.entity";
export { MortalityCount } from "../domain/value-objects/mortality-count";
export {
  MortalityCountExceedsAlive,
  InvalidMortalityCount,
} from "../domain/errors/mortality-errors";
export type { MortalityRelations } from "../domain/mortality.entity";
export type { LotSnapshot, LotInquiryPort } from "../domain/lot-inquiry.port";
export type { MortalityRepository } from "../domain/mortality.repository";
export type { LogMortalityInput } from "../application/mortality.service";
