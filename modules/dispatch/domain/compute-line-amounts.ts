import { Prisma } from "@/generated/prisma/client";
import { roundHalfUp } from "@/modules/accounting/shared/domain/money.utils";
import type { DispatchType } from "./value-objects/dispatch-type";

/**
 * Input shape for detail line calculation — matches legacy DispatchDetailInput
 * relevant fields, without Prisma dependency (R5).
 *
 * **Money math**: `lineAmount` computed via Decimal-internal arithmetic
 * (`Prisma.Decimal` + `roundHalfUp` from `modules/accounting/shared/domain/money.utils`);
 * `.toNumber()` at the `ComputedDetail.lineAmount: number` boundary (SHAPE-A).
 * R-money-tier2 discharged at poc-tier2-money-decimal-convergence C3 GREEN
 * (OLEADA 8 POC #1) — derivative from R-money (OLEADA 7 archive #2452) per
 * [[named_rule_immutability]]. `roundTotal` (round-total.ts) EXCLUDED —
 * cooperative-rounding semantic.
 *
 * R5 nuance: `Prisma` import is for `Prisma.Decimal` value-type only (decimal.js
 * re-export — NOT a generated entity). Sister precedent: money.utils.ts L25-L29
 * "R1-permissible-value-type-exception".
 */
export interface DetailLineInput {
  description: string;
  boxes: number;
  grossWeight: number;
  unitPrice: number;
  order: number;
  productTypeId?: string;
  detailNote?: string;
  shortage?: number; // BC only: manual shortage per row
}

/**
 * Computed detail with all derived fields.
 * Pure domain type — no Prisma Decimal, no infrastructure dependency.
 */
export interface ComputedDetail {
  description: string;
  boxes: number;
  grossWeight: number;
  tare: number;
  netWeight: number;
  unitPrice: number;
  lineAmount: number;
  order: number;
  productTypeId?: string;
  detailNote?: string;
  shrinkage?: number;
  shortage?: number;
  realNetWeight?: number;
}

/**
 * Pure domain function: computes all derived fields per detail line.
 *
 * - tare = boxes * 2
 * - netWeight = grossWeight - tare
 * - For NOTA_DESPACHO: lineAmount = netWeight * unitPrice (rounded to 2 decimals)
 * - For BOLETA_CERRADA: shrinkage, shortage, realNetWeight, then lineAmount
 */
export function computeLineAmounts(
  details: DetailLineInput[],
  dispatchType: DispatchType,
  shrinkagePct: number,
): ComputedDetail[] {
  return details.map((d) => {
    const tare = d.boxes * 2;
    const netWeight = d.grossWeight - tare;

    if (dispatchType === "BOLETA_CERRADA") {
      const shrinkage = netWeight * (shrinkagePct / 100);
      const shortage = d.shortage ?? 0;
      const realNetWeight = netWeight - shrinkage - shortage;
      const lineAmount = roundHalfUp(
        new Prisma.Decimal(realNetWeight).mul(d.unitPrice),
      ).toNumber();
      return {
        productTypeId: d.productTypeId,
        detailNote: d.detailNote,
        description: d.description,
        boxes: d.boxes,
        grossWeight: d.grossWeight,
        tare,
        netWeight,
        unitPrice: d.unitPrice,
        shrinkage,
        shortage,
        realNetWeight,
        lineAmount,
        order: d.order,
      };
    }

    // NOTA_DESPACHO
    const lineAmount = roundHalfUp(
      new Prisma.Decimal(netWeight).mul(d.unitPrice),
    ).toNumber();
    return {
      productTypeId: d.productTypeId,
      detailNote: d.detailNote,
      description: d.description,
      boxes: d.boxes,
      grossWeight: d.grossWeight,
      tare,
      netWeight,
      unitPrice: d.unitPrice,
      lineAmount,
      order: d.order,
    };
  });
}
