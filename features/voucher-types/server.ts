import "server-only";
import type { Prisma, VoucherTypeCfg } from "@/generated/prisma/client";
import {
  makeVoucherTypesService,
  makeVoucherTypesServiceForTx,
  type VoucherType as VoucherTypeEntity,
} from "@/modules/voucher-types/presentation/server";
import { PrismaVoucherTypeRepository as ModuleVoucherTypeRepository } from "@/modules/voucher-types/infrastructure/prisma-voucher-type.repository";
import { DEFAULT_VOUCHER_TYPES } from "@/prisma/seeds/voucher-types";
import type {
  CreateVoucherTypeInput,
  ListVoucherTypesOptions,
  UpdateVoucherTypeInput,
} from "./voucher-types.types";

const toLegacyShape = (entity: VoucherTypeEntity): VoucherTypeCfg =>
  entity.toSnapshot() as unknown as VoucherTypeCfg;

/**
 * @deprecated Backward-compat wrapper around modules/voucher-types.
 * New code should import from `@/modules/voucher-types/presentation/server`.
 *
 * The shim translates domain entities back to the Prisma `VoucherTypeCfg` row
 * shape via `toSnapshot()` — its fields are an exact superset of Prisma's
 * generated type, so the cast is safe at runtime.
 */
export class VoucherTypesService {
  async list(
    organizationId: string,
    options?: ListVoucherTypesOptions,
  ): Promise<VoucherTypeCfg[]> {
    const entities = await makeVoucherTypesService().list(organizationId, options);
    return entities.map(toLegacyShape);
  }

  async getById(organizationId: string, id: string): Promise<VoucherTypeCfg> {
    const entity = await makeVoucherTypesService().getById(organizationId, id);
    return toLegacyShape(entity);
  }

  async getByCode(organizationId: string, code: string): Promise<VoucherTypeCfg> {
    const entity = await makeVoucherTypesService().getByCode(organizationId, code);
    return toLegacyShape(entity);
  }

  async seedForOrg(
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<VoucherTypeCfg[]> {
    const service = tx
      ? makeVoucherTypesServiceForTx(tx)
      : makeVoucherTypesService();
    const entities = await service.seedForOrg(organizationId, [
      ...DEFAULT_VOUCHER_TYPES,
    ]);
    return entities.map(toLegacyShape);
  }

  async create(
    organizationId: string,
    input: CreateVoucherTypeInput,
  ): Promise<VoucherTypeCfg> {
    const entity = await makeVoucherTypesService().create(organizationId, input);
    return toLegacyShape(entity);
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdateVoucherTypeInput,
  ): Promise<VoucherTypeCfg> {
    const entity = await makeVoucherTypesService().update(
      organizationId,
      id,
      input,
    );
    return toLegacyShape(entity);
  }
}

/**
 * @deprecated Backward-compat re-export of the new module's adapter.
 * Cross-feature consumers (auto-entry-generator, dispatch/sale/purchase/payment
 * services) still import this class as a typed dependency. New code should
 * import from `@/modules/voucher-types/presentation/server`.
 */
export const VoucherTypesRepository = ModuleVoucherTypeRepository;
export type VoucherTypesRepository = InstanceType<
  typeof ModuleVoucherTypeRepository
>;

export {
  createVoucherTypeSchema,
  updateVoucherTypeSchema,
} from "@/modules/voucher-types/presentation/server";
