import "server-only";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  VOUCHER_TYPE_CODE_DUPLICATE,
  VOUCHER_TYPE_NOT_IN_ORG,
} from "@/features/shared/errors";
import { DEFAULT_VOUCHER_TYPES } from "@/prisma/seeds/voucher-types";
import { VoucherTypesRepository } from "./voucher-types.repository";
import type { VoucherTypeCfg } from "@/generated/prisma/client";
import type {
  CreateVoucherTypeInput,
  ListVoucherTypesOptions,
  UpdateVoucherTypeInput,
} from "./voucher-types.types";

export class VoucherTypesService {
  private readonly repo: VoucherTypesRepository;

  constructor(repo?: VoucherTypesRepository) {
    this.repo = repo ?? new VoucherTypesRepository();
  }

  async list(
    organizationId: string,
    options?: ListVoucherTypesOptions,
  ): Promise<VoucherTypeCfg[]> {
    return options === undefined
      ? this.repo.findAll(organizationId)
      : this.repo.findAll(organizationId, options);
  }

  async getById(organizationId: string, id: string): Promise<VoucherTypeCfg> {
    const type = await this.repo.findById(organizationId, id);
    if (!type) throw new NotFoundError("Tipo de comprobante");
    return type;
  }

  async getByCode(organizationId: string, code: string): Promise<VoucherTypeCfg> {
    const type = await this.repo.findByCode(organizationId, code);
    if (!type) {
      throw new ValidationError(
        `Tipo de comprobante ${code} no configurado para esta organización`,
        VOUCHER_TYPE_NOT_IN_ORG,
      );
    }
    return type;
  }

  async seedForOrg(organizationId: string): Promise<VoucherTypeCfg[]> {
    return this.repo.createMany(organizationId, [...DEFAULT_VOUCHER_TYPES]);
  }

  async create(
    organizationId: string,
    input: CreateVoucherTypeInput,
  ): Promise<VoucherTypeCfg> {
    const existing = await this.repo.findByCode(organizationId, input.code);
    if (existing) {
      throw new ConflictError(
        `Tipo de comprobante con código ${input.code}`,
        VOUCHER_TYPE_CODE_DUPLICATE,
      );
    }
    return this.repo.create(organizationId, input);
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdateVoucherTypeInput,
  ): Promise<VoucherTypeCfg> {
    const existing = await this.repo.findById(organizationId, id);
    if (!existing) throw new NotFoundError("Tipo de comprobante");
    return this.repo.update(organizationId, id, input);
  }
}
