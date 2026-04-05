import type {
  Dispatch,
  DispatchDetail,
  DispatchType,
  DispatchStatus,
  Contact,
} from "@/generated/prisma/client";

// ── Re-export Prisma types for convenience ──

export type { DispatchType, DispatchStatus };

// ── Composite types ──

export type DispatchWithDetails = Dispatch & {
  details: DispatchDetail[];
  contact: Contact;
  displayCode: string; // computed: ND-001, BC-042
};

// ── Input types ──

export interface DispatchDetailInput {
  productTypeId?: string; // FK to ProductType (required in form, optional here for backward compat)
  detailNote?: string; // max 200 chars
  description: string;
  boxes: number;
  grossWeight: number;
  unitPrice: number;
  shortage?: number; // BC only: faltante (manual input per row)
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
  // BC-only fields
  farmOrigin?: string;
  chickenCount?: number;
  shrinkagePct?: number; // percentage like 2.5
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
