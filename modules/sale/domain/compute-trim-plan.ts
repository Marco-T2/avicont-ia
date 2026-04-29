import type { AllocationLifoSnapshot } from "@/modules/receivables/domain/receivable.repository";

/**
 * Trim plan item — represents one allocation that the LIFO trim algorithm
 * would shrink (or zero out) if the sale's total were lowered. Strings (not
 * `MonetaryAmount`) preserve legacy parity with the read-only preview shape
 * `features/sale/sale.service.ts:30,82` (no monetary arithmetic happens
 * downstream — the UI just displays).
 */
export interface TrimPreviewItem {
  allocationId: string;
  paymentDate: string;
  originalAmount: string;
  trimmedTo: string;
}

/**
 * Pure function — given allocations ordered LIFO (newest first) and the
 * `excess` amount that must be absorbed by trimming, returns the plan with
 * only the allocations that would be modified. Mirrors legacy
 * `sale.service.ts:75-103` (fidelidad regla #1).
 */
export function computeTrimPlan(
  allocations: AllocationLifoSnapshot[],
  excess: number,
): TrimPreviewItem[] {
  const plan: TrimPreviewItem[] = [];
  let remaining = excess;

  for (const alloc of allocations) {
    if (remaining <= 0) break;
    const allocAmount = alloc.amount;
    const reduction = Math.min(allocAmount, remaining);
    const newAllocAmount = allocAmount - reduction;

    plan.push({
      allocationId: alloc.id,
      paymentDate: alloc.payment.date.toISOString().split("T")[0]!,
      originalAmount: allocAmount.toFixed(2),
      trimmedTo: newAllocAmount.toFixed(2),
    });

    remaining -= reduction;
  }

  return plan;
}
