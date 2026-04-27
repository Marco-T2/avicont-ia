import "server-only";
import { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";
import type { FiscalPeriod as FiscalPeriodEntity } from "@/modules/fiscal-periods/presentation/server";
import type { FiscalPeriod, CreateFiscalPeriodInput } from "./fiscal-periods.types";

const impl = makeFiscalPeriodsService();

const toLegacyShape = (entity: FiscalPeriodEntity): FiscalPeriod =>
  entity.toSnapshot() as FiscalPeriod;

/**
 * @deprecated Backward-compat wrapper around modules/fiscal-periods.
 * New code should import from `@/modules/fiscal-periods/presentation/server`.
 *
 * The shim translates domain entities back to the Prisma `FiscalPeriod` row
 * shape via `toSnapshot()` — its fields are an exact superset of Prisma's
 * generated type, so the cast is safe at runtime.
 */
export class FiscalPeriodsService {
  async list(organizationId: string): Promise<FiscalPeriod[]> {
    const entities = await impl.list(organizationId);
    return entities.map(toLegacyShape);
  }

  async getById(organizationId: string, id: string): Promise<FiscalPeriod> {
    const entity = await impl.getById(organizationId, id);
    return toLegacyShape(entity);
  }

  async findByDate(
    organizationId: string,
    date: Date,
  ): Promise<FiscalPeriod | null> {
    const entity = await impl.findByDate(organizationId, date);
    return entity ? toLegacyShape(entity) : null;
  }

  async create(
    organizationId: string,
    input: CreateFiscalPeriodInput,
  ): Promise<FiscalPeriod> {
    const entity = await impl.create(organizationId, input);
    return toLegacyShape(entity);
  }
}
