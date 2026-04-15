import type {
  Purchase,
  PurchaseDetail,
  PurchaseType,
  PurchaseStatus,
} from "@/generated/prisma/client";
import type { IvaPurchaseBookDTO } from "@/features/accounting/iva-books/iva-books.types";

// ── Re-exportar tipos de Prisma para mayor comodidad ──

export type { PurchaseType, PurchaseStatus };
export type { IvaPurchaseBookDTO };

// ── Tipos compuestos ──

export interface PaymentAllocationSummary {
  id: string;
  paymentId: string;
  amount: number;
  payment: {
    id: string;
    date: string; // cadena ISO (serializada desde DateTime en JSON)
    description: string;
  };
}

export interface PayableSummary {
  id: string;
  amount: number;
  paid: number;
  balance: number;
  status: string; // PayableStatus como string
  dueDate: Date;
  allocations: PaymentAllocationSummary[];
}

export interface PurchaseDetailRow
  extends Omit<
    PurchaseDetail,
    | "lineAmount"
    | "pricePerChicken"
    | "grossWeight"
    | "tare"
    | "netWeight"
    | "unitPrice"
    | "shrinkage"
    | "shortage"
    | "realNetWeight"
    | "quantity"
  > {
  lineAmount: number;
  pricePerChicken: number | null;
  grossWeight: number | null;
  tare: number | null;
  netWeight: number | null;
  unitPrice: number | null;
  shrinkage: number | null;
  shortage: number | null;
  realNetWeight: number | null;
  quantity: number | null;
}

export interface PurchaseWithDetails
  extends Omit<
    Purchase,
    | "totalAmount"
    | "shrinkagePct"
    | "totalGrossKg"
    | "totalNetKg"
    | "totalShrinkKg"
    | "totalShortageKg"
    | "totalRealNetKg"
  > {
  totalAmount: number;
  shrinkagePct: number | null;
  totalGrossKg: number | null;
  totalNetKg: number | null;
  totalShrinkKg: number | null;
  totalShortageKg: number | null;
  totalRealNetKg: number | null;
  contact: {
    id: string;
    name: string;
    type: string;
    nit?: string | null;
    paymentTermsDays?: number | null;
  };
  period: {
    id: string;
    name: string;
    status: string;
  };
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  details: PurchaseDetailRow[];
  payable?: PayableSummary | null;
  displayCode: string; // calculado: FL-001, PF-042, CG-003, SV-007
  ivaPurchaseBook?: IvaPurchaseBookDTO | null;
}

// ── Tipos de entrada ──

export interface CreatePurchaseDetailInput {
  description: string;
  lineAmount?: number; // opcional — puede venir pre-calculado o ser calculado por el servicio
  order?: number;
  // Columnas FLETE
  fecha?: Date;
  docRef?: string;
  chickenQty?: number;
  pricePerChicken?: number;
  // Columnas POLLO_FAENADO
  productTypeId?: string;
  detailNote?: string;
  boxes?: number;
  grossWeight?: number;
  tare?: number;
  netWeight?: number;
  unitPrice?: number;
  shrinkage?: number;
  shortage?: number;
  realNetWeight?: number;
  // Columnas COMPRA_GENERAL / SERVICIO
  quantity?: number;
  expenseAccountId?: string;
}

export interface CreatePurchaseInput {
  purchaseType: PurchaseType;
  date: string; // cadena ISO — convertida a Date por el servicio
  contactId: string;
  periodId: string;
  description: string;
  referenceNumber?: number;
  notes?: string;
  // Solo FLETE
  ruta?: string;
  // Solo POLLO_FAENADO
  farmOrigin?: string;
  chickenCount?: number;
  shrinkagePct?: number; // porcentaje, por ejemplo 2.5
  details: CreatePurchaseDetailInput[];
}

export interface UpdatePurchaseInput {
  date?: string;
  contactId?: string;
  description?: string;
  referenceNumber?: number;
  notes?: string;
  ruta?: string;
  farmOrigin?: string;
  chickenCount?: number;
  shrinkagePct?: number;
  details?: CreatePurchaseDetailInput[];
}

export interface PurchaseFilters {
  purchaseType?: PurchaseType;
  status?: PurchaseStatus;
  contactId?: string;
  periodId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}
