import {
  NotFoundError,
  ConflictError,
  PRODUCT_TYPE_DUPLICATE_CODE,
} from "@/features/shared/errors";
import { ProductTypesRepository } from "./product-types.repository";
import type {
  ProductType,
  CreateProductTypeInput,
  UpdateProductTypeInput,
  ProductTypeFilters,
} from "./product-types.types";

export class ProductTypesService {
  private readonly repo: ProductTypesRepository;

  constructor(repo?: ProductTypesRepository) {
    this.repo = repo ?? new ProductTypesRepository();
  }

  // ── List product types ──

  async list(
    organizationId: string,
    filters?: ProductTypeFilters,
  ): Promise<ProductType[]> {
    // Default: only active
    const effectiveFilters: ProductTypeFilters =
      filters?.isActive !== undefined ? filters : { isActive: true };
    return this.repo.findAll(organizationId, effectiveFilters);
  }

  // ── Get a single product type ──

  async getById(organizationId: string, id: string): Promise<ProductType> {
    const productType = await this.repo.findById(organizationId, id);
    if (!productType) throw new NotFoundError("Tipo de producto");
    return productType;
  }

  // ── Create a product type ──

  async create(
    organizationId: string,
    input: CreateProductTypeInput,
  ): Promise<ProductType> {
    const existing = await this.repo.findByCode(organizationId, input.code);
    if (existing) {
      throw new ConflictError(
        `Un tipo de producto con el código "${input.code}"`,
        PRODUCT_TYPE_DUPLICATE_CODE,
      );
    }
    return this.repo.create(organizationId, input);
  }

  // ── Update a product type ──

  async update(
    organizationId: string,
    id: string,
    input: UpdateProductTypeInput,
  ): Promise<ProductType> {
    // Verify exists
    await this.getById(organizationId, id);

    // Check code uniqueness if code is changing
    if (input.code !== undefined) {
      const duplicate = await this.repo.findByCode(organizationId, input.code);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError(
          `Un tipo de producto con el código "${input.code}"`,
          PRODUCT_TYPE_DUPLICATE_CODE,
        );
      }
    }

    return this.repo.update(organizationId, id, input);
  }

  // ── Deactivate a product type (soft delete) ──

  async deactivate(organizationId: string, id: string): Promise<ProductType> {
    // Verify exists
    await this.getById(organizationId, id);
    return this.repo.deactivate(organizationId, id);
  }
}
