import { describe, it, expect } from "vitest";
import { PaymentAllocation } from "../payment-allocation.entity";
import { AllocationTarget } from "../value-objects/allocation-target";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import { InvalidMonetaryAmount } from "@/modules/shared/domain/errors/monetary-errors";
import { AllocationMustBePositive } from "../errors/payment-errors";

const baseInput = {
  paymentId: "pay-1",
  target: AllocationTarget.forReceivable("rec-1"),
  amount: 250,
};

describe("PaymentAllocation child entity", () => {
  describe("create()", () => {
    it("assigns a UUID id", () => {
      const a = PaymentAllocation.create(baseInput);
      expect(a.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("preserves paymentId, target, and amount", () => {
      const a = PaymentAllocation.create(baseInput);
      expect(a.paymentId).toBe("pay-1");
      expect(a.target.kind).toBe("RECEIVABLE");
      expect(a.target.id).toBe("rec-1");
      expect(a.amount.value).toBe(250);
    });

    it("exposes receivableId / payableId convenience getters", () => {
      const r = PaymentAllocation.create(baseInput);
      expect(r.receivableId).toBe("rec-1");
      expect(r.payableId).toBeNull();

      const p = PaymentAllocation.create({
        paymentId: "pay-1",
        target: AllocationTarget.forPayable("pay-cxp-1"),
        amount: 100,
      });
      expect(p.payableId).toBe("pay-cxp-1");
      expect(p.receivableId).toBeNull();
    });

    // Failure mode declarado: AllocationMustBePositive (validation, PAYMENT_ALLOCATION_MUST_BE_POSITIVE).
    it("rejects amount of zero with AllocationMustBePositive", () => {
      expect(() =>
        PaymentAllocation.create({ ...baseInput, amount: 0 }),
      ).toThrow(AllocationMustBePositive);
    });

    // Failure mode declarado: InvalidMonetaryAmount (validation, INVALID_MONETARY_AMOUNT)
    // — la validación de negativos vive en el VO compartido y se propaga.
    it("rejects negative amount via MonetaryAmount", () => {
      expect(() =>
        PaymentAllocation.create({ ...baseInput, amount: -1 }),
      ).toThrow(InvalidMonetaryAmount);
    });

    it("accepts string amount and normalizes", () => {
      const a = PaymentAllocation.create({ ...baseInput, amount: "123.45" });
      expect(a.amount.value).toBe(123.45);
    });
  });

  describe("fromPersistence()", () => {
    it("hydrates without re-validating positivity", () => {
      const a = PaymentAllocation.fromPersistence({
        id: "alloc-1",
        paymentId: "pay-1",
        target: AllocationTarget.forPayable("pay-cxp-9"),
        amount: MonetaryAmount.of(42.5),
      });
      expect(a.id).toBe("alloc-1");
      expect(a.paymentId).toBe("pay-1");
      expect(a.target.kind).toBe("PAYABLE");
      expect(a.amount.value).toBe(42.5);
    });
  });

  describe("toSnapshot()", () => {
    it("returns a POJO with monetary amount as number and target ids", () => {
      const a = PaymentAllocation.create(baseInput);
      const snap = a.toSnapshot();
      expect(typeof snap.amount).toBe("number");
      expect(snap.amount).toBe(250);
      expect(snap.id).toBe(a.id);
      expect(snap.paymentId).toBe("pay-1");
      expect(snap.receivableId).toBe("rec-1");
      expect(snap.payableId).toBeNull();
    });
  });
});
