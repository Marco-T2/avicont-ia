import type { ProductType } from "./product-type.entity";

export interface ProductTypesRepository {
  findAll(
    organizationId: string,
    filters?: { isActive?: boolean },
  ): Promise<ProductType[]>;
  findById(
    organizationId: string,
    id: string,
  ): Promise<ProductType | null>;
  findByCode(
    organizationId: string,
    code: string,
  ): Promise<ProductType | null>;
  save(productType: ProductType): Promise<void>;
}
