import "server-only";
import type { ChickenLot } from "@/generated/prisma/client";
import type { FarmSnapshot } from "../domain/ports/farm-inquiry.port";

export {
  makeFarmService,
  makeFarmRepository,
  PrismaFarmRepository,
  LocalFarmInquiryAdapter,
} from "./composition-root";

export { createFarmSchema, updateFarmSchema } from "./validation";

export { Farm } from "../domain/farm.entity";
export type {
  FarmProps,
  CreateFarmInput,
  UpdateFarmInput,
} from "../domain/farm.entity";
export type { FarmRepository, FarmFilters } from "../domain/farm.repository";
export type { MemberInquiryPort } from "../domain/ports/member-inquiry.port";
export type {
  FarmInquiryPort,
  FarmSnapshot,
} from "../domain/ports/farm-inquiry.port";
export {
  FarmService,
  type CreateFarmServiceInput,
} from "../application/farm.service";
export {
  FarmAlreadyExists,
  FarmNotFound,
  MemberInactiveOrMissing,
} from "../domain/errors/farm-errors";

export { attachLots } from "./composition-root";

export type FarmSnapshotWithLots = FarmSnapshot & { lots: ChickenLot[] };
