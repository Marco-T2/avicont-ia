import type {
  Payment,
  PaymentMethod,
  PaymentStatus,
  Contact,
  AccountsReceivable,
  AccountsPayable,
} from "@/generated/prisma/client";

// ── Re-export Prisma types for convenience ──

export type { PaymentMethod, PaymentStatus };

// ── Composite types ──

export type PaymentWithRelations = Payment & {
  contact: Contact;
  receivable?: AccountsReceivable | null;
  payable?: AccountsPayable | null;
};

// ── Input types ──

export interface CreatePaymentInput {
  method: PaymentMethod;
  date: Date;
  amount: number;
  description: string;
  periodId: string;
  referenceNumber?: number;
  receivableId?: string;
  payableId?: string;
  notes?: string;
  createdById: string;
}

export interface UpdatePaymentInput {
  method?: PaymentMethod;
  date?: Date;
  amount?: number;
  description?: string;
  referenceNumber?: number;
  notes?: string;
}

export interface PaymentFilters {
  status?: PaymentStatus;
  method?: PaymentMethod;
  contactId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  periodId?: string;
  receivableId?: string;
  payableId?: string;
}
