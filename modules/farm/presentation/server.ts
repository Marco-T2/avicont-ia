import "server-only";

export {
  makeFarmService,
  makeFarmRepository,
  PrismaFarmRepository,
} from "./composition-root";

export { createFarmSchema, updateFarmSchema } from "./validation";

export { Farm } from "../domain/farm.entity";
export type {
  FarmProps,
  FarmSnapshot,
  CreateFarmInput,
  UpdateFarmInput,
} from "../domain/farm.entity";
export type { FarmRepository, FarmFilters } from "../domain/farm.repository";
export type { MemberInquiryPort } from "../domain/ports/member-inquiry.port";
export {
  FarmService,
  type CreateFarmServiceInput,
} from "../application/farm.service";
export {
  FarmAlreadyExists,
  FarmNotFound,
  MemberInactiveOrMissing,
} from "../domain/errors/farm-errors";
