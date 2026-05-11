import type { ProductType as PrismaProductType } from "@/generated/prisma/client";
import { ProductType } from "../domain/product-type.entity";

export function toDomain(row: PrismaProductType): ProductType {
  return ProductType.fromPersistence({
    id: row.id,
    organizationId: row.organizationId,
    code: row.code,
    name: row.name,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function toPersistence(entity: ProductType) {
  const s = entity.toSnapshot();
  return {
    id: s.id,
    organizationId: s.organizationId,
    code: s.code,
    name: s.name,
    isActive: s.isActive,
    sortOrder: s.sortOrder,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}
