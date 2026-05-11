import "server-only";
import { prisma } from "@/lib/prisma";
import { type PrismaClient } from "@/generated/prisma/client";
import type { ProductTypesRepository } from "../domain/product-type.repository";
import { ProductType } from "../domain/product-type.entity";
import { ProductTypeDuplicateCodeError } from "../domain/errors/product-type-errors";
import { toDomain, toPersistence } from "./product-type.mapper";

type DbClient = Pick<PrismaClient, "productType">;

export class PrismaProductTypesRepository implements ProductTypesRepository {
  constructor(private readonly db: DbClient = prisma) {}

  async findAll(
    organizationId: string,
    filters?: { isActive?: boolean },
  ): Promise<ProductType[]> {
    const rows = await this.db.productType.findMany({
      where: {
        organizationId,
        ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return rows.map(toDomain);
  }

  async findById(
    organizationId: string,
    id: string,
  ): Promise<ProductType | null> {
    const row = await this.db.productType.findFirst({
      where: { id, organizationId },
    });
    return row ? toDomain(row) : null;
  }

  async findByCode(
    organizationId: string,
    code: string,
  ): Promise<ProductType | null> {
    const row = await this.db.productType.findFirst({
      where: { organizationId, code },
    });
    return row ? toDomain(row) : null;
  }

  async save(entity: ProductType): Promise<void> {
    const data = toPersistence(entity);
    try {
      await this.db.productType.upsert({
        where: { id: data.id },
        create: data,
        update: {
          name: data.name,
          code: data.code,
          isActive: data.isActive,
          sortOrder: data.sortOrder,
          updatedAt: data.updatedAt,
        },
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error as { code: string }).code === "P2002"
      ) {
        throw new ProductTypeDuplicateCodeError(entity.code);
      }
      throw error;
    }
  }
}
