import type {
  PaymentMethod,
  PaymentStatus,
} from "@/generated/prisma/client";
import type { UnappliedPaymentSnapshot } from "@/modules/payment/presentation/server";

// ── Re-export Prisma types for convenience ──

export type { PaymentMethod, PaymentStatus };

// ── Re-exports from the module (shim is a thin wrapper) ──

export type {
  PaymentDirection,
  CreditAllocationSource,
  AllocationInput,
} from "@/modules/payment/presentation/server";

// ── Alias: module's UnappliedPaymentSnapshot is the legacy UnappliedPayment ──

export type UnappliedPayment = UnappliedPaymentSnapshot;

// ── Input types ──

export interface CreatePaymentInput {
  method: PaymentMethod;
  date: Date;
  amount: number;
  direction?: import("@/modules/payment/presentation/server").PaymentDirection;
  description: string;
  periodId: string;
  contactId: string;
  referenceNumber?: number;
  operationalDocTypeId?: string;
  accountCode?: string;
  allocations: import("@/modules/payment/presentation/server").AllocationInput[];
  notes?: string;
  createdById: string;
  creditSources?: import("@/modules/payment/presentation/server").CreditAllocationSource[];
}

export interface UpdatePaymentInput {
  method?: PaymentMethod;
  date?: Date;
  amount?: number;
  description?: string;
  referenceNumber?: number;
  operationalDocTypeId?: string | null;
  accountCode?: string | null;
  allocations?: import("@/modules/payment/presentation/server").AllocationInput[];
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
