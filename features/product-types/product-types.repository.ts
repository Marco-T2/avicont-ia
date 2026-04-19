import "server-only";
import { BaseRepository } from "@/features/shared/base.repository";
import type { ProductType } from "@/generated/prisma/client";
import type {
  CreateProductTypeInput,
  UpdateProductTypeInput,
  ProductTypeFilters,
} from "./product-types.types";

export class ProductTypesRepository extends BaseRepository {
  async findAll(
    organizationId: string,
    filters?: ProductTypeFilters,
  ): Promise<ProductType[]> {
    const scope = this.requireOrg(organizationId);

    return this.db.productType.findMany({
      where: {
        ...scope,
        ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  async findById(organizationId: string, id: string): Promise<ProductType | null> {
    const scope = this.requireOrg(organizationId);

    return this.db.productType.findFirst({
      where: { id, ...scope },
    });
  }

  async findByCode(organizationId: string, code: string): Promise<ProductType | null> {
    const scope = this.requireOrg(organizationId);

    return this.db.productType.findFirst({
      where: { code, ...scope },
    });
  }

  async create(
    organizationId: string,
    data: CreateProductTypeInput,
  ): Promise<ProductType> {
    const scope = this.requireOrg(organizationId);

    return this.db.productType.create({
      data: {
        organizationId: scope.organizationId,
        name: data.name,
        code: data.code,
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      },
    });
  }

  async update(
    organizationId: string,
    id: string,
    data: UpdateProductTypeInput,
  ): Promise<ProductType> {
    const scope = this.requireOrg(organizationId);

    return this.db.productType.update({
      where: { id, ...scope },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.code !== undefined && { code: data.code }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      },
    });
  }

  async deactivate(organizationId: string, id: string): Promise<ProductType> {
    const scope = this.requireOrg(organizationId);

    return this.db.productType.update({
      where: { id, ...scope },
      data: { isActive: false },
    });
  }
}
