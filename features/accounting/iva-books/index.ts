// ── Repository ────────────────────────────────────────────────────────────────
export { IvaBooksRepository } from "./iva-books.repository";
export type { ListIvaBooksFilter } from "./iva-books.repository";

// ── Service ───────────────────────────────────────────────────────────────────
export { IvaBooksService } from "./iva-books.service";

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  IvaBookStatus,
  IvaSalesEstadoSIN,
  IvaBookMonetaryFields,
  CreatePurchaseInput,
  CreateSaleInput,
  UpdatePurchaseInput,
  UpdateSaleInput,
  IvaPurchaseBookDTO,
  IvaSalesBookDTO,
  ListIvaBooksQuery,
  Decimal,
} from "./iva-books.types";

// ── Validation ────────────────────────────────────────────────────────────────
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
  ListQueryDto,
} from "./iva-books.validation";

// ── Calc utils ────────────────────────────────────────────────────────────────
export {
  calcSubtotal,
  calcBaseImponible,
  calcIvaCreditoFiscal,
  calcDebitoFiscal,
  calcTotales,
} from "./iva-calc.utils";

export type {
  CalcSubtotalParams,
  CalcTotalesParams,
  CalcTotalesResult,
} from "./iva-calc.utils";

// ── Exporters ─────────────────────────────────────────────────────────────────
export { exportIvaBookExcel } from "./exporters/excel.exporter";
export { getColumns, dataColumnCount } from "./exporters/sheet.builder";
export type { IvaBookColumn, ColumnType } from "./exporters/sheet.builder";
