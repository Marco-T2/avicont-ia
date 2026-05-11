import "server-only";
import { ProductTypeService } from "../application/product-type.service";
import { PrismaProductTypesRepository } from "../infrastructure/prisma-product-types.repository";

export { PrismaProductTypesRepository };

export function makeProductTypeService(): ProductTypeService {
  return new ProductTypeService(
    new PrismaProductTypesRepository(),
  );
}
