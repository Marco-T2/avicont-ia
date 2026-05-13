/**
 * Client-safe barrel — re-exports types + validation schemas.
 * NO server imports (no service, no exporter, no TASA_IVA Decimal — Decimal
 * runtime requires Prisma client which is server-only).
 */
export type {
  IvaPurchaseBookDTO,
  IvaSalesBookDTO,
  CreatePurchaseInput,
  CreateSaleInput,
  UpdatePurchaseInput,
  UpdateSaleInput,
  IvaBookMonetaryFields,
  IvaBookStatus,
  IvaSalesEstadoSIN,
  Decimal,
} from "../domain/iva-books.types";

export {
  createPurchaseInputSchema,
  createSaleInputSchema,
  updatePurchaseInputSchema,
  updateSaleInputSchema,
  listQuerySchema,
} from "../domain/iva-books.validation";
export type {
  CreatePurchaseInputDto,
  CreateSaleInputDto,
  UpdatePurchaseInputDto,
  UpdateSaleInputDto,
} from "../domain/iva-books.validation";
