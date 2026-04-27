import "server-only";
import { makeMortalityService } from "@/modules/mortality/presentation/server";
import type { Mortality } from "@/modules/mortality/presentation/server";
import type {
  LogMortalityInput,
  MortalityLogWithRelations,
} from "./mortality.types";

const impl = makeMortalityService();

const toLegacyShape = (m: Mortality): MortalityLogWithRelations =>
  m.toJSON() as MortalityLogWithRelations;

/**
 * @deprecated Backward-compat wrapper around modules/mortality.
 * New code should import directly from `@/modules/mortality/presentation/server`.
 * This shim exists so existing consumers (pricing, agent route, mortality route,
 * lot pages) keep working while the rest of the codebase migrates incrementally.
 *
 * The shim translates domain entities back to MortalityLogWithRelations shape
 * via `Mortality.toJSON()` — which is a stable contract on the entity.
 */
export class MortalityService {
  async listByLot(
    organizationId: string,
    lotId: string,
  ): Promise<MortalityLogWithRelations[]> {
    const entities = await impl.listByLot(organizationId, lotId);
    return entities.map(toLegacyShape);
  }

  async log(
    organizationId: string,
    input: LogMortalityInput,
  ): Promise<MortalityLogWithRelations> {
    const entity = await impl.log(organizationId, input);
    return toLegacyShape(entity);
  }

  async getTotalByLot(
    organizationId: string,
    lotId: string,
  ): Promise<number> {
    return impl.getTotalByLot(organizationId, lotId);
  }
}

export * from "./mortality.validation";
