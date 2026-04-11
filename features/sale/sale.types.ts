import type {
  Sale,
  SaleDetail,
  SaleStatus,
} from "@/generated/prisma/client";

// ── Re-exportar tipos de Prisma para mayor comodidad ──

export type { SaleStatus };

// ── Tipos compuestos ──

export interface PaymentAllocationSummary {
  id: string;
  paymentId: string;
  amount: number;
  payment: {
    id: string;
    date: string;
    description: string;
  };
}

export interface ReceivableSummary {
  id: string;
  amount: number;
  paid: number;
  balance: number;
  status: string;
  dueDate: Date;
  allocations: PaymentAllocationSummary[];
}

export interface SaleDetailRow
  extends Omit<SaleDetail, "lineAmount" | "quantity" | "unitPrice"> {
  lineAmount: number;
  quantity: number | null;
  unitPrice: number | null;
}

export interface SaleWithDetails
  extends Omit<Sale, "totalAmount"> {
  totalAmount: number;
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
  };
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  details: SaleDetailRow[];
  receivable?: ReceivableSummary | null;
  displayCode: string;
}

// ── Tipos de entrada ──

export interface CreateSaleDetailInput {
  description: string;
  lineAmount?: number;
  order?: number;
  quantity?: number;
  unitPrice?: number;
  incomeAccountId: string;
}

export interface CreateSaleInput {
  date: string; // cadena ISO — convertida a Date por el servicio
  contactId: string;
  periodId: string;
  description: string;
  referenceNumber?: number;
  notes?: string;
  details: CreateSaleDetailInput[];
}

export interface UpdateSaleInput {
  date?: string;
  contactId?: string;
  description?: string;
  referenceNumber?: number;
  notes?: string;
  details?: CreateSaleDetailInput[];
}

export interface SaleFilters {
  status?: SaleStatus;
  contactId?: string;
  periodId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}
