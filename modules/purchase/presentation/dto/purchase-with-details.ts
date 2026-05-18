import type {
  Purchase,
  PurchaseDetail,
  PurchaseType,
  PurchaseStatus,
} from "@/generated/prisma/client";

/**
 * Hydrates Purchase read-side responses for routes/components — migrado
 * bit-exact (POC nuevo A3-C1 + atomic delete A3-C8 commit 4aa8480).
 *
 * Mirror sale precedent `modules/sale/presentation/dto/sale-with-details.ts`
 * (POC #11.0a A5 β Ciclo 3) — paridad arquitectónica + paridad bit-exact con
 * legacy.
 *
 * Asimetría legítima vs sale precedent: re-export `PurchaseType` +
 * `PurchaseStatus` (6 consumers app/{components,pages,routes} — A3-C2 cutover).
 *
 * ivaPurchaseBook field retired in lcv-feature-retirement (RND 102100000011
 * Dec-2021).
 */

export type { PurchaseType, PurchaseStatus };

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

export interface PayableSummary {
  id: string;
  amount: number;
  paid: number;
  balance: number;
  status: string;
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
  details: PurchaseDetailRow[];
  payable?: PayableSummary | null;
}
