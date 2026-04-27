import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { isPrismaUniqueViolation } from "@/features/shared/prisma-errors";
import type {
  VoucherTypeRepository,
  ListVoucherTypesOptions,
} from "../domain/voucher-type.repository";
import { VoucherType } from "../domain/voucher-type.entity";
import { VoucherTypeCodeDuplicate } from "../domain/errors/voucher-type-errors";
import { toDomain, toPersistence } from "./voucher-type.mapper";

// Index name from prisma migration. Mirrored as a literal so any rename in the
// schema fails this trip-wire and the adapter test in lockstep.
const UNIQUE_CODE_INDEX = "voucher_types_organizationId_code_key";

type DbClient = Pick<PrismaClient, "voucherTypeCfg">;

export class PrismaVoucherTypeRepository implements VoucherTypeRepository {
  constructor(private readonly db: DbClient = prisma) {}

  withTransaction(tx: Prisma.TransactionClient): PrismaVoucherTypeRepository {
    return new PrismaVoucherTypeRepository(tx as unknown as DbClient);
  }

  async findAll(
    organizationId: string,
    options: ListVoucherTypesOptions = {},
  ): Promise<VoucherType[]> {
    const where = {
      organizationId,
      ...(options.isActive !== undefined && { isActive: options.isActive }),
    };
    const rows = await this.db.voucherTypeCfg.findMany({
      where,
      orderBy: { code: "asc" },
      ...(options.includeCounts && {
        include: { _count: { select: { journalEntries: true } } },
      }),
    });
    return rows.map(toDomain);
  }

  async findById(
    organizationId: string,
    id: string,
  ): Promise<VoucherType | null> {
    const row = await this.db.voucherTypeCfg.findFirst({
      where: { id, organizationId },
    });
    return row ? toDomain(row) : null;
  }

  async findByCode(
    organizationId: string,
    code: string,
  ): Promise<VoucherType | null> {
    const row = await this.db.voucherTypeCfg.findFirst({
      where: { code, organizationId },
    });
    return row ? toDomain(row) : null;
  }

  async save(entity: VoucherType): Promise<void> {
    try {
      await this.db.voucherTypeCfg.create({ data: toPersistence(entity) });
    } catch (err) {
      if (isPrismaUniqueViolation(err, UNIQUE_CODE_INDEX)) {
        throw new VoucherTypeCodeDuplicate(entity.code);
      }
      throw err;
    }
  }

  async update(entity: VoucherType): Promise<void> {
    await this.db.voucherTypeCfg.update({
      where: { id: entity.id, organizationId: entity.organizationId },
      data: {
        name: entity.name,
        prefix: entity.prefix,
        description: entity.description,
        isActive: entity.isActive,
      },
    });
  }

  async saveMany(entities: VoucherType[]): Promise<void> {
    for (const entity of entities) {
      const data = toPersistence(entity);
      await this.db.voucherTypeCfg.upsert({
        where: {
          organizationId_code: {
            organizationId: data.organizationId,
            code: data.code,
          },
        },
        create: data,
        update: {},
      });
    }
  }
}
