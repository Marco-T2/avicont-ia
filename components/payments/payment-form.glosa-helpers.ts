import type { PaymentAllocationGlosa } from "@/modules/payment/domain/payment-glosa-builder";

/**
 * Subset of payment-form `AllocationLine` consumed by the glosa builder.
 * Kept structural so any `AllocationLine` satisfies it without explicit cast.
 */
export interface FormAllocationForGlosa {
  checked: boolean;
  type: "receivable" | "payable";
  assignedAmount: string;
  sourceTypeCode: string | null;
  referenceNumber: number | null;
  sourceDate: Date;
}

/**
 * Filters checked receivable AND payable allocations with a positive
 * `assignedAmount` and maps them to the `PaymentAllocationGlosa` shape
 * consumed by `buildPaymentGlosa`. Both sides are included (design D8):
 * COBRO surfaces receivables, PAGO surfaces payables, and the form only ever
 * fetches one side's documents — so accepting both is safe and direction-
 * agnostic here.
 *
 * - `referenceNumber: null` → empty string (builder renders `VG-` with no number).
 * - `sourceTypeCode: null` → preserved (builder falls back to `DOC-` per design D5).
 */
export function selectGlosaAllocations(
  allocations: FormAllocationForGlosa[],
): PaymentAllocationGlosa[] {
  return allocations
    .filter(
      (a) =>
        a.checked &&
        (a.type === "receivable" || a.type === "payable") &&
        (parseFloat(a.assignedAmount) || 0) > 0,
    )
    .map((a) => ({
      sourceTypeCode: a.sourceTypeCode,
      referenceNumber: a.referenceNumber !== null ? String(a.referenceNumber) : "",
      sourceDate: a.sourceDate,
    }));
}
