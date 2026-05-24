/**
 * Per-line "max assignable" cap when editing an existing payment's allocations.
 *
 * A POSTED/LOCKED allocation already reduced the document's persisted balance,
 * so the allocation amount must be added back to recover the pre-payment max
 * (the line can re-allocate up to the full original balance).
 *
 * A DRAFT was never applied (drafts don't call applyAllocation), so the
 * persisted balance is ALREADY the full max — adding the allocation back would
 * inflate the cap and let the UI offer an over-allocation the server rejects at
 * POST. VOIDED behaves like DRAFT here: the allocation was reverted and the
 * balance restored, so nothing is added. (draft-credit-leak sibling.)
 */
export function maxAssignableBalance(
  persistedBalance: number,
  allocationAmount: number,
  paymentStatus: string,
): number {
  const applied = paymentStatus === "POSTED" || paymentStatus === "LOCKED";
  return persistedBalance + (applied ? allocationAmount : 0);
}
