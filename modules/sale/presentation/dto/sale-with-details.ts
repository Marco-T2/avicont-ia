import type {
  Sale,
  SaleDetail,
} from "@/generated/prisma/client";
import type { IvaSalesBookDTO } from "@/features/accounting/iva-books";

/**
 * Hydrates Sale read-side responses for routes/components — migrado bit-exact
 * (POC #11.0a A5 β + POC nuevo A3-C7 atomic delete commit ad36da2).
 *
 * `displayCode` queda como property del DTO presentation — separación
 * domain/presentation lockeada A2 audit (D-A5#5 α): aggregate hex `Sale`
 * NO expone displayCode (presentation concern).
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
  displayCode: string;
  ivaSalesBook?: IvaSalesBookDTO | null;
}
