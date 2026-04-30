import type { AllocationLifoSnapshot } from "@/modules/payables/domain/payable.repository";

/**
 * LIFO trim plan helper for purchase edit-cascade. Mirrors legacy
 * `purchase.service.ts:69-104` (fidelidad regla #1). Same algorithm as
 * sale-hex `compute-trim-plan.ts`, con `AllocationLifoSnapshot` importado
 * desde `payables/domain` — promovido en POC #11.0b A2 Ciclo 2 (§13
 * emergente E-1, paridad con sale-hex Ciclo 3 commit `c24224e`).
 */

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
