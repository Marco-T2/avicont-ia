import "server-only";
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

  // ── Listar tipos de producto ──

  async list(
    organizationId: string,
    filters?: ProductTypeFilters,
  ): Promise<ProductType[]> {
    // Por defecto: solo activos
    const effectiveFilters: ProductTypeFilters =
      filters?.isActive !== undefined ? filters : { isActive: true };
    return this.repo.findAll(organizationId, effectiveFilters);
  }

  // ── Obtener un tipo de producto individual ──

  async getById(organizationId: string, id: string): Promise<ProductType> {
    const productType = await this.repo.findById(organizationId, id);
    if (!productType) throw new NotFoundError("Tipo de producto");
    return productType;
  }

  // ── Crear un tipo de producto ──

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

  // ── Actualizar un tipo de producto ──

  async update(
    organizationId: string,
    id: string,
    input: UpdateProductTypeInput,
  ): Promise<ProductType> {
    // Verificar que existe
    await this.getById(organizationId, id);

    // Verificar unicidad del código si está cambiando
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

  // ── Desactivar un tipo de producto (borrado suave) ──

  async deactivate(organizationId: string, id: string): Promise<ProductType> {
    // Verificar que existe
    await this.getById(organizationId, id);
    return this.repo.deactivate(organizationId, id);
  }
}
