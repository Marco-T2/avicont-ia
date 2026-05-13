import "server-only";

export { IvaBookService } from "../application/iva-book.service";
export { makeIvaBookService, makeIvaScopeFactory } from "./composition-root";

// ── Domain types re-exports (REQ-003) ─────────────────────────────────────────
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

// ── Validation schema re-exports (REQ-004) ────────────────────────────────────
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

// ── Legacy-bridge Decimal TASA_IVA (REQ-005, IVA-D2) ─────────────────────────
export { TASA_IVA } from "./legacy-bridge-constants";

// ── Exporter re-export (wired at C1 GREEN) ────────────────────────────────────
// export { exportIvaBookExcel } from "../infrastructure/exporters/iva-book-xlsx.exporter"; // TODO: wired at C1 GREEN
