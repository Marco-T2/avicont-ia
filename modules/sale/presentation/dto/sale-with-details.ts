import type {
  Sale,
  SaleDetail,
} from "@/generated/prisma/client";

/**
 * Hydrates Sale read-side responses for routes/components — migrado bit-exact
 * (POC #11.0a A5 β + POC nuevo A3-C7 atomic delete commit ad36da2).
 *
 * ivaSalesBook field retired in lcv-feature-retirement (RND 102100000011
 * Dec-2021).
 */

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

export interface SaleWithDetails extends Omit<Sale, "totalAmount"> {
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
    status: string;
  };
  details: SaleDetailRow[];
  receivable?: ReceivableSummary | null;
}
