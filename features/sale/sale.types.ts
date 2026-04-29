import type { SaleStatus } from "@/generated/prisma/client";

// ── Re-exportar tipos de Prisma para mayor comodidad ──

export type { SaleStatus };

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
