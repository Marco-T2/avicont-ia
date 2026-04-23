/**
 * Client-safe barrel — re-exports types, validation schemas, and pure utils.
 * NO server imports here (no repository, no service, no server-only).
 */
export type {
  CreatePurchaseInput,
  CreateSaleInput,
  UpdatePurchaseInput,
  UpdateSaleInput,
  IvaPurchaseBookDTO,
  IvaSalesBookDTO,
} from "./iva-books.types";

export {
  createPurchaseInputSchema,
  createSaleInputSchema,
  updatePurchaseInputSchema,
  updateSaleInputSchema,
  listQuerySchema,
} from "./iva-books.validation";
export type {
  CreatePurchaseInputDto,
  CreateSaleInputDto,
  UpdatePurchaseInputDto,
  UpdateSaleInputDto,
} from "./iva-books.validation";

export { calcTotales } from "./iva-calc.utils";
