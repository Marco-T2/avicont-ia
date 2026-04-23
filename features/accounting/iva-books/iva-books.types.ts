import type { Prisma } from "@/generated/prisma/client";
import type {
  IvaBookStatus,
  IvaSalesEstadoSIN,
} from "@/generated/prisma/enums";

// ── Re-exports públicos de los enums Prisma ───────────────────────────────────
export type { IvaBookStatus, IvaSalesEstadoSIN };

// Alias local para Decimal (igual que financial-statements)
export type Decimal = Prisma.Decimal;

// ── Campos monetarios compartidos entre compras y ventas ──────────────────────

export type IvaBookMonetaryFields = {
  importeTotal: Decimal;
  importeIce: Decimal;
  importeIehd: Decimal;
  importeIpj: Decimal;
  tasas: Decimal;
  otrosNoSujetos: Decimal;
  exentos: Decimal;
  tasaCero: Decimal;
  subtotal: Decimal;
  dfIva: Decimal;
  codigoDescuentoAdicional: Decimal;
  importeGiftCard: Decimal;
  baseIvaSujetoCf: Decimal;
  dfCfIva: Decimal;
  tasaIva: Decimal;
};

// ── Inputs de creación ────────────────────────────────────────────────────────

export type CreatePurchaseInput = IvaBookMonetaryFields & {
  fechaFactura: string; // ISO 8601 date string "YYYY-MM-DD"
  nitProveedor: string;
  razonSocial: string;
  numeroFactura: string;
  codigoAutorizacion: string;
  codigoControl?: string;
  tipoCompra: number;
  fiscalPeriodId: string;
  purchaseId?: string;
  notes?: string;
};

export type CreateSaleInput = IvaBookMonetaryFields & {
  fechaFactura: string; // ISO 8601 date string "YYYY-MM-DD"
  nitCliente: string;
  razonSocial: string;
  numeroFactura: string;
  codigoAutorizacion: string;
  codigoControl?: string;
  estadoSIN: IvaSalesEstadoSIN;
  fiscalPeriodId: string;
  saleId?: string;
  notes?: string;
};

// ── Inputs de actualización (parciales) ───────────────────────────────────────

export type UpdatePurchaseInput = Partial<CreatePurchaseInput>;

export type UpdateSaleInput = Partial<CreateSaleInput>;

// ── DTOs de salida ────────────────────────────────────────────────────────────

export type IvaPurchaseBookDTO = CreatePurchaseInput & {
  id: string;
  organizationId: string;
  status: IvaBookStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type IvaSalesBookDTO = CreateSaleInput & {
  id: string;
  organizationId: string;
  status: IvaBookStatus;
  createdAt: Date;
  updatedAt: Date;
};
