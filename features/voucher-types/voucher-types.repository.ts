import { BaseRepository } from "@/features/shared/base.repository";
import type { VoucherTypeCfg } from "@/generated/prisma/client";
import type { CreateVoucherTypeInput, UpdateVoucherTypeInput } from "./voucher-types.types";

export class VoucherTypesRepository extends BaseRepository {
  async findAll(organizationId: string): Promise<VoucherTypeCfg[]> {
    const scope = this.requireOrg(organizationId);
    return this.db.voucherTypeCfg.findMany({
      where: scope,
      orderBy: { code: "asc" },
    });
  }

  async findById(organizationId: string, id: string): Promise<VoucherTypeCfg | null> {
    const scope = this.requireOrg(organizationId);
    return this.db.voucherTypeCfg.findFirst({
      where: { id, ...scope },
    });
  }

  async findByCode(
    organizationId: string,
    code: string,
  ): Promise<VoucherTypeCfg | null> {
    const scope = this.requireOrg(organizationId);
    return this.db.voucherTypeCfg.findFirst({
      where: { code: code as never, ...scope },
    });
  }

  async createMany(
    organizationId: string,
    types: CreateVoucherTypeInput[],
  ): Promise<VoucherTypeCfg[]> {
    const scope = this.requireOrg(organizationId);
    const results: VoucherTypeCfg[] = [];

    for (const type of types) {
      const result = await this.db.voucherTypeCfg.upsert({
        where: {
          organizationId_code: {
            organizationId: scope.organizationId,
            code: type.code,
          },
        },
        create: {
          ...scope,
          code: type.code,
          name: type.name,
          description: type.description ?? null,
        },
        update: {},
      });
      results.push(result);
    }

    return results;
  }

  async update(
    organizationId: string,
    id: string,
    data: UpdateVoucherTypeInput,
  ): Promise<VoucherTypeCfg> {
    const scope = this.requireOrg(organizationId);
    return this.db.voucherTypeCfg.update({
      where: { id, ...scope },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }
}
