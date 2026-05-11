import "server-only";

export {
  makeProductTypeService,
  PrismaProductTypesRepository,
} from "./composition-root";

export {
  createProductTypeSchema,
  updateProductTypeSchema,
} from "./validation";

export { ProductType } from "../domain/product-type.entity";
export type {
  ProductTypeProps,
  CreateProductTypeInput,
  ProductTypeSnapshot,
} from "../domain/product-type.entity";
export type { ProductTypesRepository } from "../domain/product-type.repository";
export {
  ProductTypeService,
  type CreateProductTypeServiceInput,
  type UpdateProductTypeServiceInput,
} from "../application/product-type.service";
export type { ProductTypesInquiryPort } from "../domain/ports/product-type-inquiry.port";
export {
  ProductTypeNotFoundError,
  ProductTypeDuplicateCodeError,
} from "../domain/errors/product-type-errors";
