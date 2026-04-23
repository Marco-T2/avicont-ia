import "server-only";
import { BaseRepository } from "@/features/shared/base.repository";
import type { VoucherTypeCfg, Prisma } from "@/generated/prisma/client";
import type {
  CreateVoucherTypeInput,
  ListVoucherTypesOptions,
  UpdateVoucherTypeInput,
} from "./voucher-types.types";

export class VoucherTypesRepository extends BaseRepository {
  async findAll(
    organizationId: string,
    options: ListVoucherTypesOptions = {},
  ): Promise<VoucherTypeCfg[]> {
    const scope = this.requireOrg(organizationId);
    const where = {
      ...scope,
      ...(options.isActive !== undefined && { isActive: options.isActive }),
    };
    return this.db.voucherTypeCfg.findMany({
      where,
      orderBy: { code: "asc" },
      ...(options.includeCounts && {
        include: { _count: { select: { journalEntries: true } } },
      }),
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
      where: { code, ...scope },
    });
  }

  async create(
    organizationId: string,
    input: CreateVoucherTypeInput,
  ): Promise<VoucherTypeCfg> {
    const scope = this.requireOrg(organizationId);
    return this.db.voucherTypeCfg.create({
      data: {
        ...scope,
        code: input.code,
        prefix: input.prefix,
        name: input.name,
        description: input.description ?? null,
      },
    });
  }

  async createMany(
    organizationId: string,
    types: CreateVoucherTypeInput[],
    tx?: Prisma.TransactionClient,
  ): Promise<VoucherTypeCfg[]> {
    const scope = this.requireOrg(organizationId);
    const db = tx ?? this.db;
    const results: VoucherTypeCfg[] = [];

    for (const type of types) {
      const result = await db.voucherTypeCfg.upsert({
        where: {
          organizationId_code: {
            organizationId: scope.organizationId,
            code: type.code,
          },
        },
        create: {
          ...scope,
          code: type.code,
          prefix: type.prefix,
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
        ...(data.prefix !== undefined && { prefix: data.prefix }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }
}
