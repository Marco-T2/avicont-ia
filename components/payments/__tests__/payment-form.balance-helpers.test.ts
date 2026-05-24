import { describe, it, expect } from "vitest";
import { maxAssignableBalance } from "../payment-form.balance-helpers";

/**
 * maxAssignableBalance — the per-line cap when editing an existing payment's
 * allocations. A POSTED/LOCKED allocation already reduced the document's
 * persisted balance, so it must be added back to recover the pre-payment max.
 *
 * A DRAFT was never applied (drafts don't call applyAllocation), so the
 * persisted balance is ALREADY the full max — adding the allocation back would
 * inflate the cap and let the user over-apply (server rejects it at POST, but
 * the UI should not offer it). draft-credit-leak sibling.
 */
describe("maxAssignableBalance", () => {
  it("adds the allocation back for POSTED payments (allocation already reduced the balance)", () => {
    expect(maxAssignableBalance(232, 1000, "POSTED")).toBe(1232);
  });

  it("adds the allocation back for LOCKED payments (posted-then-locked)", () => {
    expect(maxAssignableBalance(232, 1000, "LOCKED")).toBe(1232);
  });

  it("does NOT inflate for DRAFT payments (never applied; balance already full)", () => {
    expect(maxAssignableBalance(1232, 1000, "DRAFT")).toBe(1232);
  });

  it("does NOT inflate for VOIDED payments (allocation reverted, balance restored)", () => {
    expect(maxAssignableBalance(1232, 1000, "VOIDED")).toBe(1232);
  });
});
