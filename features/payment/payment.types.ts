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

// ── Credit source types ──

/** Input to specify which credit payment to use as source for a new allocation */
export interface CreditAllocationSource {
  sourcePaymentId: string;
  receivableId: string;
  amount: number;
}

/** Unapplied payment available as credit for a contact */
export interface UnappliedPayment {
  id: string;
  date: Date;
  amount: number;
  description: string;
  totalAllocated: number;
  available: number;
}

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
  contact: Contact;
  period: FiscalPeriod;
  journalEntry: JournalEntry | null;
  operationalDocType?: { id: string; code: string; name: string } | null;
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
  direction?: PaymentDirection;
  description: string;
  periodId: string;
  contactId: string;
  referenceNumber?: number;
  operationalDocTypeId?: string;
  accountCode?: string;
  allocations: AllocationInput[];
  notes?: string;
  createdById: string;
  creditSources?: CreditAllocationSource[];
}

export interface UpdatePaymentInput {
  method?: PaymentMethod;
  date?: Date;
  amount?: number;
  description?: string;
  referenceNumber?: number;
  operationalDocTypeId?: string | null;
  accountCode?: string | null;
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
