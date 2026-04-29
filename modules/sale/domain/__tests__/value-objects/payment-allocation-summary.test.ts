import { describe, it, expect } from "vitest";
import { PaymentAllocationSummary } from "../../value-objects/payment-allocation-summary";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

describe("PaymentAllocationSummary VO", () => {
  it("hidrata desde persistencia con sub-tree del payment", () => {
    const alloc = PaymentAllocationSummary.fromPersistence({
      id: "alloc-1",
      paymentId: "pmt-1",
      amount: MonetaryAmount.of(150),
      payment: {
        id: "pmt-1",
        date: new Date("2026-04-15"),
        description: "Anticipo cliente",
      },
    });
    expect(alloc.id).toBe("alloc-1");
    expect(alloc.paymentId).toBe("pmt-1");
    expect(alloc.amount.value).toBe(150);
    expect(alloc.payment.id).toBe("pmt-1");
    expect(alloc.payment.date).toEqual(new Date("2026-04-15"));
    expect(alloc.payment.description).toBe("Anticipo cliente");
  });

  it("acepta description vacío del payment", () => {
    const alloc = PaymentAllocationSummary.fromPersistence({
      id: "alloc-2",
      paymentId: "pmt-2",
      amount: MonetaryAmount.of(50),
      payment: { id: "pmt-2", date: new Date(), description: "" },
    });
    expect(alloc.payment.description).toBe("");
  });
});
