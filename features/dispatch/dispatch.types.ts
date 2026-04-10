import type {
  Dispatch,
  DispatchDetail,
  DispatchType,
  DispatchStatus,
  Contact,
} from "@/generated/prisma/client";

// ── Re-exportar tipos de Prisma por conveniencia ──

export type { DispatchType, DispatchStatus };

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

export interface ReceivableSummary {
  id: string;
  amount: number;
  paid: number;
  balance: number;
  status: string; // ReceivableStatus como string
  allocations: PaymentAllocationSummary[];
}

export type DispatchWithDetails = Dispatch & {
  details: DispatchDetail[];
  contact: Contact;
  displayCode: string; // calculado: ND-001, BC-042
  receivable?: ReceivableSummary | null;
};

// ── Tipos de entrada ──

export interface DispatchDetailInput {
  productTypeId?: string; // FK a ProductType (requerido en el formulario, opcional aquí por compatibilidad)
  detailNote?: string; // máximo 200 caracteres
  description: string;
  boxes: number;
  grossWeight: number;
  unitPrice: number;
  shortage?: number; // Solo BC: faltante (entrada manual por fila)
  order: number;
}

export interface CreateDispatchInput {
  dispatchType: DispatchType;
  date: Date;
  contactId: string;
  periodId: string;
  description: string;
  referenceNumber?: number;
  notes?: string;
  createdById: string;
  // Campos exclusivos de BC
  farmOrigin?: string;
  chickenCount?: number;
  shrinkagePct?: number; // porcentaje, ej. 2.5
  details: DispatchDetailInput[];
}

export interface UpdateDispatchInput {
  date?: Date;
  contactId?: string;
  description?: string;
  referenceNumber?: number;
  notes?: string;
  farmOrigin?: string;
  chickenCount?: number;
  shrinkagePct?: number;
  details?: DispatchDetailInput[];
}

export interface DispatchFilters {
  dispatchType?: DispatchType;
  status?: DispatchStatus;
  contactId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  periodId?: string;
}
