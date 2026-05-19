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
 * Filters checked receivable allocations with a positive `assignedAmount`
 * and maps them to the `PaymentAllocationGlosa` shape consumed by
 * `buildPaymentGlosa`. Payables are excluded — COBRO glosa scope only.
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
        a.type === "receivable" &&
        (parseFloat(a.assignedAmount) || 0) > 0,
    )
    .map((a) => ({
      sourceTypeCode: a.sourceTypeCode,
      referenceNumber: a.referenceNumber !== null ? String(a.referenceNumber) : "",
      sourceDate: a.sourceDate,
    }));
}
