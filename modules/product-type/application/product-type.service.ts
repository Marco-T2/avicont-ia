import {
  ProductType,
  type CreateProductTypeInput,
} from "../domain/product-type.entity";
import type { ProductTypesRepository } from "../domain/product-type.repository";
import { ProductTypeNotFoundError } from "../domain/errors/product-type-errors";

export type CreateProductTypeServiceInput = Omit<
  CreateProductTypeInput,
  "organizationId"
>;

export type UpdateProductTypeServiceInput = {
  name?: string;
  code?: string;
  isActive?: boolean;
  sortOrder?: number;
};

export class ProductTypeService {
  constructor(private readonly repo: ProductTypesRepository) {}

  async list(
    organizationId: string,
    filters?: { isActive?: boolean },
  ): Promise<ProductType[]> {
    const effectiveFilters: { isActive?: boolean } =
      filters?.isActive !== undefined ? filters : { ...filters, isActive: true };
    return this.repo.findAll(organizationId, effectiveFilters);
  }

  async getById(
    organizationId: string,
    id: string,
  ): Promise<ProductType> {
    const found = await this.repo.findById(organizationId, id);
    if (!found) throw new ProductTypeNotFoundError(id);
    return found;
  }

  async create(
    organizationId: string,
    input: CreateProductTypeServiceInput,
  ): Promise<ProductType> {
    const productType = ProductType.create({ ...input, organizationId });
    await this.repo.save(productType);
    return productType;
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdateProductTypeServiceInput,
  ): Promise<ProductType> {
    const productType = await this.getById(organizationId, id);
    if (input.name !== undefined) productType.rename(input.name);
    if (input.code !== undefined) productType.changeCode(input.code);
    if (input.sortOrder !== undefined) productType.changeSortOrder(input.sortOrder);
    if (input.isActive !== undefined) {
      if (input.isActive) {
        productType.activate();
      } else {
        productType.deactivate();
      }
    }
    await this.repo.save(productType);
    return productType;
  }

  async deactivate(
    organizationId: string,
    id: string,
  ): Promise<ProductType> {
    const productType = await this.getById(organizationId, id);
    productType.deactivate();
    await this.repo.save(productType);
    return productType;
  }
}
