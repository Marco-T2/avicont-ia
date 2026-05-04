import { NotFoundError } from "@/features/shared/errors";
import { DEFAULT_VOUCHER_TYPES } from "@/prisma/seeds/voucher-types";
import type {
  VoucherTypeRepository,
  ListVoucherTypesOptions,
} from "../domain/voucher-type.repository";
import { VoucherType } from "../domain/voucher-type.entity";
import {
  VoucherTypeCodeDuplicate,
  VoucherTypeNotInOrg,
} from "../domain/errors/voucher-type-errors";

export interface CreateVoucherTypeServiceInput {
  code: string;
  prefix: string;
  name: string;
  description?: string;
}

export interface UpdateVoucherTypeServiceInput {
  name?: string;
  prefix?: string;
  description?: string;
  isActive?: boolean;
}

export interface SeedVoucherTypeInput {
  code: string;
  prefix: string;
  name: string;
  description: string;
  isAdjustment: boolean;
}

export class VoucherTypesService {
  constructor(private readonly repo: VoucherTypeRepository) {}

  async list(
    organizationId: string,
    options?: ListVoucherTypesOptions,
  ): Promise<VoucherType[]> {
    return this.repo.findAll(organizationId, options);
  }

  async getById(organizationId: string, id: string): Promise<VoucherType> {
    const found = await this.repo.findById(organizationId, id);
    if (!found) throw new NotFoundError("Tipo de comprobante");
    return found;
  }

  async getByCode(organizationId: string, code: string): Promise<VoucherType> {
    const found = await this.repo.findByCode(organizationId, code);
    if (!found) throw new VoucherTypeNotInOrg(code);
    return found;
  }

  async create(
    organizationId: string,
    input: CreateVoucherTypeServiceInput,
  ): Promise<VoucherType> {
    const duplicate = await this.repo.findByCode(organizationId, input.code);
    if (duplicate) throw new VoucherTypeCodeDuplicate(input.code);

    const entity = VoucherType.create({
      organizationId,
      code: input.code,
      prefix: input.prefix,
      name: input.name,
      description: input.description,
    });

    await this.repo.save(entity);
    return entity;
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdateVoucherTypeServiceInput,
  ): Promise<VoucherType> {
    let entity = await this.repo.findById(organizationId, id);
    if (!entity) throw new NotFoundError("Tipo de comprobante");

    if (input.name !== undefined) entity = entity.rename(input.name);
    if (input.prefix !== undefined) entity = entity.changePrefix(input.prefix);
    if (input.description !== undefined) {
      entity = entity.updateDescription(input.description);
    }
    if (input.isActive !== undefined) {
      entity = input.isActive ? entity.activate() : entity.deactivate();
    }

    await this.repo.update(entity);
    return entity;
  }

  async seedForOrg(
    organizationId: string,
    types: readonly SeedVoucherTypeInput[],
  ): Promise<VoucherType[]> {
    const entities = types.map((t) =>
      VoucherType.create({
        organizationId,
        code: t.code,
        prefix: t.prefix,
        name: t.name,
        description: t.description,
        isAdjustment: t.isAdjustment,
      }),
    );
    await this.repo.saveMany(entities);
    return entities;
  }

  /**
   * Seed the project-wide default voucher types catalog for a newly created
   * organization. Wraps `seedForOrg(orgId, DEFAULT_VOUCHER_TYPES)` and routes
   * through a tx-aware service when `tx` is provided, so callers like
   * `OrganizationsService.syncOrganization` can seed within an active
   * transaction without knowing the catalog or the tx-aware factory.
   *
   * §13.A5-ε Option D-3 method-on-class — awkward circular dep with
   * presentation/composition-root mitigated via dynamic import; tx parameter
   * typed `unknown` (cast via Parameters<typeof factory>) to avoid a Prisma
   * import in the application layer (R5).
   */
  async seedDefaultsForOrg(
    organizationId: string,
    tx?: unknown,
  ): Promise<VoucherType[]> {
    if (tx === undefined) {
      return this.seedForOrg(organizationId, [...DEFAULT_VOUCHER_TYPES]);
    }
    const { makeVoucherTypesServiceForTx } = await import(
      "../presentation/composition-root"
    );
    return makeVoucherTypesServiceForTx(
      tx as Parameters<typeof makeVoucherTypesServiceForTx>[0],
    ).seedForOrg(organizationId, [...DEFAULT_VOUCHER_TYPES]);
  }
}
