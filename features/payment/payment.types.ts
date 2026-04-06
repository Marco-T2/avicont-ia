import type {
  Payment,
  PaymentMethod,
  PaymentStatus,
  Contact,
  PaymentAllocation,
  AccountsReceivable,
  AccountsPayable,
  FiscalPeriod,
  JournalEntry,
} from "@/generated/prisma/client";

// ── Re-export Prisma types for convenience ──

export type { PaymentMethod, PaymentStatus };

// ── Allocation types ──

/** Allocation input for create/update */
export interface AllocationInput {
  receivableId?: string;
  payableId?: string;
  amount: number;
}

/** Allocation with resolved target info (for display) */
export interface AllocationWithTarget {
  id: string;
  receivableId: string | null;
  payableId: string | null;
  amount: number;
  target: {
    description: string;
    totalAmount: number;
    paid: number;
    balance: number;
    sourceType?: string | null;
    sourceId?: string | null;
  };
}

/** Payment type inferred from allocations */
export type PaymentDirection = "COBRO" | "PAGO";

// ── Composite types ──

export type PaymentWithRelations = Omit<Payment, "amount"> & {
  amount: number;
  creditApplied: number;
  contact: Contact;
  period: FiscalPeriod;
  journalEntry: JournalEntry | null;
  allocations: (Omit<PaymentAllocation, "amount"> & {
    amount: number;
    receivable?: (AccountsReceivable & { contact: Contact }) | null;
    payable?: (AccountsPayable & { contact: Contact }) | null;
  })[];
};

// ── Input types ──

export interface CreatePaymentInput {
  method: PaymentMethod;
  date: Date;
  amount: number;
  creditApplied?: number;
  direction?: PaymentDirection;
  description: string;
  periodId: string;
  contactId: string;
  referenceNumber?: number;
  allocations: AllocationInput[];
  notes?: string;
  createdById: string;
}

export interface UpdatePaymentInput {
  method?: PaymentMethod;
  date?: Date;
  amount?: number;
  description?: string;
  referenceNumber?: number;
  allocations?: AllocationInput[];
  notes?: string;
}

export interface PaymentFilters {
  status?: PaymentStatus;
  method?: PaymentMethod;
  contactId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  periodId?: string;
}

export interface UpdateAllocationsInput {
  allocations: AllocationInput[];
  justification?: string;
}
