/**
 * LIFO trim plan helper for purchase edit-cascade. Mirrors legacy
 * `purchase.service.ts:69-104` (fidelidad regla #1). Same algorithm as
 * sale-hex `compute-trim-plan.ts`, with purchase-side allocation snapshot.
 *
 * `AllocationLifoSnapshot` defined locally — payables-hex domain does not
 * yet expose this shape. §11.1 STICK on-arrival: keep local until a 3rd
 * consumer surfaces (precedente PaymentAllocationSummary C2).
 */

export interface AllocationLifoSnapshot {
  id: string;
  amount: number;
  payment: { date: Date };
}

export interface TrimPreviewItem {
  allocationId: string;
  paymentDate: string;
  originalAmount: string;
  trimmedTo: string;
}

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
