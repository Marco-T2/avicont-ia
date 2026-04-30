/**
 * Computes POLLO_FAENADO header totalKg summary from already-computed
 * detail rows. Pure helper — no side effects, no validation. Mirrors
 * legacy `purchase.service.ts:143-167` (fidelidad regla #1) extracted to
 * domain per β decision (C4) — aggregate stays thin, use case calls this
 * helper before passing totals into Purchase.createDraft.
 */

export interface ComputedPurchaseDetail {
  grossWeight?: number;
  netWeight?: number;
  shrinkage?: number;
  shortage?: number;
  realNetWeight?: number;
}

export interface PfSummary {
  totalGrossKg: number;
  totalNetKg: number;
  totalShrinkKg: number;
  totalShortageKg: number;
  totalRealNetKg: number;
}

export function computePfSummary(
  computedDetails: ComputedPurchaseDetail[],
): PfSummary {
  const totalGrossKg = computedDetails.reduce(
    (s, d) => s + (d.grossWeight ?? 0),
    0,
  );
  const totalNetKg = computedDetails.reduce(
    (s, d) => s + (d.netWeight ?? 0),
    0,
  );
  const totalShrinkKg = computedDetails.reduce(
    (s, d) => s + (d.shrinkage ?? 0),
    0,
  );
  const totalShortageKg = computedDetails.reduce(
    (s, d) => s + (d.shortage ?? 0),
    0,
  );
  const totalRealNetKg = computedDetails.reduce(
    (s, d) => s + (d.realNetWeight ?? 0),
    0,
  );
  return {
    totalGrossKg,
    totalNetKg,
    totalShrinkKg,
    totalShortageKg,
    totalRealNetKg,
  };
}
