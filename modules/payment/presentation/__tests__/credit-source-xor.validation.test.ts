/**
 * pago-credit-system Phase 5 — credit-source target XOR on the payment Zod
 * schemas (`createPaymentSchema` / `updatePaymentSchema`, validation.ts).
 *
 * The create/update payment routes thread `creditSources` through these schemas
 * (route.ts:56 / [paymentId]/route.ts:39). For Phase 6's PAGO payable credit to
 * survive parse on those paths, `creditAllocationSourceSchema` must accept
 * `receivableId | payableId` XOR — mirror of `allocationInputSchema`
 * (validation.ts:14) and of the apply-credits inline schema.
 *
 * Expected RED failure mode pre-GREEN (feedback_red_acceptance_failure_mode):
 *   - (a) PAGO payable credit FAILS Zod parse: `receivableId: z.string()` is a
 *     REQUIRED field today, so a payable-only credit source throws on parse —
 *     `safeParse(...).success` is `false` (expected `true`). Discriminating RED.
 *   - (c) BOTH set is ACCEPTED today (no XOR refine; Zod strips nothing here
 *     because both keys would be declared) → `success` true (expected false).
 *   - (b) receivable-only and (d) the schema-presence cases pass pre-GREEN.
 */
import { describe, it, expect } from "vitest";
import { createPaymentSchema, updatePaymentSchema } from "../validation";

const BASE_CREATE = {
  method: "EFECTIVO" as const,
  date: "2026-05-23",
  amount: 100,
  description: "test",
  periodId: "period-1",
  contactId: "contact-1",
  allocations: [],
};

describe("pago-credit-system Phase 5 — credit-source target XOR (validation.ts)", () => {
  it("(a) createPaymentSchema accepts a PAGO payable credit source (payableId set, receivableId absent)", () => {
    const result = createPaymentSchema.safeParse({
      ...BASE_CREATE,
      creditSources: [{ sourcePaymentId: "src-1", payableId: "payable-1", amount: 40 }],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.creditSources).toEqual([
        { sourcePaymentId: "src-1", payableId: "payable-1", amount: 40 },
      ]);
    }
  });

  it("(b) createPaymentSchema accepts a COBRO receivable credit source (backward-compat)", () => {
    const result = createPaymentSchema.safeParse({
      ...BASE_CREATE,
      creditSources: [{ sourcePaymentId: "src-1", receivableId: "recv-1", amount: 30 }],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.creditSources).toEqual([
        { sourcePaymentId: "src-1", receivableId: "recv-1", amount: 30 },
      ]);
    }
  });

  it("(c) createPaymentSchema rejects a credit source with BOTH ids set", () => {
    const result = createPaymentSchema.safeParse({
      ...BASE_CREATE,
      creditSources: [
        { sourcePaymentId: "src-1", receivableId: "recv-1", payableId: "payable-1", amount: 20 },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("(d) createPaymentSchema rejects a credit source with NEITHER id set", () => {
    const result = createPaymentSchema.safeParse({
      ...BASE_CREATE,
      creditSources: [{ sourcePaymentId: "src-1", amount: 10 }],
    });

    expect(result.success).toBe(false);
  });

  it("(e) updatePaymentSchema accepts a PAGO payable credit source on the edit path", () => {
    const result = updatePaymentSchema.safeParse({
      allocations: [{ payableId: "payable-1", amount: 40 }],
      creditSources: [{ sourcePaymentId: "src-1", payableId: "payable-2", amount: 40 }],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.creditSources).toEqual([
        { sourcePaymentId: "src-1", payableId: "payable-2", amount: 40 },
      ]);
    }
  });
});
