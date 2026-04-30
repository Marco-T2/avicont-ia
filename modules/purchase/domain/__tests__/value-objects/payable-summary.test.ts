import { describe, it, expect } from "vitest";
import { PayableSummary } from "../../value-objects/payable-summary";
import { PaymentAllocationSummary } from "../../value-objects/payment-allocation-summary";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

describe("PayableSummary VO", () => {
  it("hidrata desde persistencia con campos básicos sin allocations", () => {
    const summary = PayableSummary.fromPersistence({
      id: "pay-1",
      amount: MonetaryAmount.of(500),
      paid: MonetaryAmount.zero(),
      balance: MonetaryAmount.of(500),
      status: "PENDING",
      dueDate: new Date("2026-05-01"),
      allocations: [],
    });
    expect(summary.id).toBe("pay-1");
    expect(summary.amount.value).toBe(500);
    expect(summary.paid.value).toBe(0);
    expect(summary.balance.value).toBe(500);
    expect(summary.status).toBe("PENDING");
    expect(summary.dueDate).toEqual(new Date("2026-05-01"));
    expect(summary.allocations).toEqual([]);
  });

  it("hidrata con allocations adjuntas", () => {
    const alloc = PaymentAllocationSummary.fromPersistence({
      id: "alloc-1",
      paymentId: "pmt-1",
      amount: MonetaryAmount.of(200),
      payment: {
        id: "pmt-1",
        date: new Date("2026-04-15"),
        description: "Pago parcial",
      },
    });
    const summary = PayableSummary.fromPersistence({
      id: "pay-1",
      amount: MonetaryAmount.of(500),
      paid: MonetaryAmount.of(200),
      balance: MonetaryAmount.of(300),
      status: "PARTIAL",
      dueDate: new Date("2026-05-01"),
      allocations: [alloc],
    });
    expect(summary.allocations).toHaveLength(1);
    expect(summary.allocations[0]!.id).toBe("alloc-1");
    expect(summary.allocations[0]!.amount.value).toBe(200);
  });

  it("expone allocations como copia defensiva (immutable)", () => {
    const alloc = PaymentAllocationSummary.fromPersistence({
      id: "alloc-1",
      paymentId: "pmt-1",
      amount: MonetaryAmount.of(100),
      payment: { id: "pmt-1", date: new Date(), description: "" },
    });
    const summary = PayableSummary.fromPersistence({
      id: "pay-1",
      amount: MonetaryAmount.of(100),
      paid: MonetaryAmount.of(100),
      balance: MonetaryAmount.zero(),
      status: "PAID",
      dueDate: new Date(),
      allocations: [alloc],
    });
    const exposed = summary.allocations;
    exposed.push(alloc);
    expect(summary.allocations).toHaveLength(1);
  });
});
