import type {
  Purchase,
  PurchaseDetail,
  PurchaseType,
  PurchaseStatus,
} from "@/generated/prisma/client";
import type { IvaPurchaseBookDTO } from "@/modules/iva-books/presentation/index";

/**
 * Hydrates Purchase read-side responses for routes/components — migrado
 * bit-exact (POC nuevo A3-C1 + atomic delete A3-C8 commit 4aa8480).
 *
 * Mirror sale precedent `modules/sale/presentation/dto/sale-with-details.ts`
 * (POC #11.0a A5 β Ciclo 3) — paridad arquitectónica + paridad bit-exact con
 * legacy. `displayCode` queda como property del DTO presentation (separación
 * domain/presentation lockeada A2 audit D-A5#5 α: aggregate hex `Purchase` NO
 * expone displayCode — presentation concern).
 *
 * Asimetría legítima vs sale precedent: re-export `PurchaseType` +
 * `PurchaseStatus` + `IvaPurchaseBookDTO` (sale tiene 0 consumers root barrel;
 * purchase tiene 6 consumers app/{components,pages,routes} — A3-C2 cutover).
 */

export type { PurchaseType, PurchaseStatus };
export type { IvaPurchaseBookDTO };

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
  displayCode: string;
  ivaPurchaseBook?: IvaPurchaseBookDTO | null;
}
