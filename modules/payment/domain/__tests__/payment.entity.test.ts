import { describe, it, expect } from "vitest";
import { Payment } from "../payment.entity";
import { PaymentAllocation } from "../payment-allocation.entity";
import { AllocationTarget } from "../value-objects/allocation-target";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import { InvalidMonetaryAmount } from "@/modules/shared/domain/errors/monetary-errors";
import {
  InvalidPaymentStatusTransition,
  PaymentMixedAllocation,
  PaymentAllocationsExceedTotal,
  CannotModifyVoidedPayment,
} from "../errors/payment-errors";

const baseInput = {
  organizationId: "org-1",
  method: "EFECTIVO" as const,
  date: new Date("2026-04-15T00:00:00Z"),
  amount: 1000,
  description: "Cobro factura 0001",
  periodId: "period-1",
  contactId: "contact-1",
  createdById: "user-1",
};

function alloc(target: AllocationTarget, amount: number, paymentId = "ignored") {
  return PaymentAllocation.create({ paymentId, target, amount });
}

describe("Payment aggregate root", () => {
  describe("create()", () => {
    it("returns a Payment in DRAFT status", () => {
      const p = Payment.create(baseInput);
      expect(p.status).toBe("DRAFT");
    });

    it("assigns a UUID id", () => {
      const p = Payment.create(baseInput);
      expect(p.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("starts with an empty allocations array when none provided", () => {
      const p = Payment.create(baseInput);
      expect(p.allocations).toEqual([]);
    });

    it("preserves required fields", () => {
      const p = Payment.create(baseInput);
      expect(p.organizationId).toBe("org-1");
      expect(p.method).toBe("EFECTIVO");
      expect(p.amount.value).toBe(1000);
      expect(p.description).toBe("Cobro factura 0001");
      expect(p.periodId).toBe("period-1");
      expect(p.contactId).toBe("contact-1");
      expect(p.createdById).toBe("user-1");
      expect(p.date.getTime()).toBe(baseInput.date.getTime());
    });

    it("optional fields default to null", () => {
      const p = Payment.create(baseInput);
      expect(p.referenceNumber).toBeNull();
      expect(p.journalEntryId).toBeNull();
      expect(p.notes).toBeNull();
      expect(p.accountCode).toBeNull();
      expect(p.operationalDocTypeId).toBeNull();
    });

    it("propagates optional fields when provided", () => {
      const p = Payment.create({
        ...baseInput,
        referenceNumber: 42,
        notes: "x",
        accountCode: "1.1.01",
        operationalDocTypeId: "doctype-1",
      });
      expect(p.referenceNumber).toBe(42);
      expect(p.notes).toBe("x");
      expect(p.accountCode).toBe("1.1.01");
      expect(p.operationalDocTypeId).toBe("doctype-1");
    });

    it("createdAt and updatedAt are equal at creation", () => {
      const p = Payment.create(baseInput);
      expect(p.createdAt.getTime()).toBe(p.updatedAt.getTime());
    });

    // Failure mode declarado: InvalidMonetaryAmount (validation, INVALID_MONETARY_AMOUNT).
    it("rejects negative amount via MonetaryAmount", () => {
      expect(() => Payment.create({ ...baseInput, amount: -1 })).toThrow(
        InvalidMonetaryAmount,
      );
    });

    it("accepts amount of zero (credit-only payment)", () => {
      const p = Payment.create({ ...baseInput, amount: 0 });
      expect(p.amount.value).toBe(0);
    });

    it("accepts initial allocations", () => {
      const p = Payment.create({
        ...baseInput,
        allocations: [
          { target: AllocationTarget.forReceivable("rec-1"), amount: 600 },
          { target: AllocationTarget.forReceivable("rec-2"), amount: 400 },
        ],
      });
      expect(p.allocations.length).toBe(2);
      expect(p.allocations[0].receivableId).toBe("rec-1");
      expect(p.allocations[0].paymentId).toBe(p.id);
      expect(p.allocations[1].receivableId).toBe("rec-2");
    });

    // Failure mode declarado: PaymentMixedAllocation (validation, PAYMENT_MIXED_ALLOCATION).
    it("rejects mixed receivable+payable allocations with PaymentMixedAllocation", () => {
      expect(() =>
        Payment.create({
          ...baseInput,
          allocations: [
            { target: AllocationTarget.forReceivable("rec-1"), amount: 100 },
            { target: AllocationTarget.forPayable("pay-1"), amount: 100 },
          ],
        }),
      ).toThrow(PaymentMixedAllocation);
    });

    // Failure mode declarado: PaymentAllocationsExceedTotal (validation, PAYMENT_ALLOCATIONS_EXCEED_TOTAL).
    it("rejects when sum(allocations) > amount with PaymentAllocationsExceedTotal", () => {
      expect(() =>
        Payment.create({
          ...baseInput,
          amount: 100,
          allocations: [
            { target: AllocationTarget.forReceivable("rec-1"), amount: 100.01 },
          ],
        }),
      ).toThrow(PaymentAllocationsExceedTotal);
    });

    it("accepts sum(allocations) === amount", () => {
      const p = Payment.create({
        ...baseInput,
        amount: 1000,
        allocations: [
          { target: AllocationTarget.forReceivable("rec-1"), amount: 1000 },
        ],
      });
      expect(p.totalAllocated.value).toBe(1000);
      expect(p.unappliedAmount.value).toBe(0);
    });

    it("accepts sum(allocations) < amount (over-payment / credit)", () => {
      const p = Payment.create({
        ...baseInput,
        amount: 1000,
        allocations: [
          { target: AllocationTarget.forReceivable("rec-1"), amount: 600 },
        ],
      });
      expect(p.totalAllocated.value).toBe(600);
      expect(p.unappliedAmount.value).toBe(400);
    });
  });

  describe("fromPersistence()", () => {
    it("hydrates without re-validating amount > 0", () => {
      const al = PaymentAllocation.fromPersistence({
        id: "alloc-1",
        paymentId: "pay-x",
        target: AllocationTarget.forReceivable("rec-1"),
        amount: MonetaryAmount.of(300),
      });
      const p = Payment.fromPersistence({
        id: "pay-x",
        organizationId: "org-1",
        status: "POSTED",
        method: "EFECTIVO",
        date: new Date("2026-04-15"),
        amount: MonetaryAmount.of(500),
        description: "x",
        periodId: "period-1",
        contactId: "contact-1",
        referenceNumber: null,
        journalEntryId: "je-1",
        notes: null,
        accountCode: null,
        operationalDocTypeId: null,
        createdById: "user-1",
        createdAt: new Date("2026-04-01"),
        updatedAt: new Date("2026-04-15"),
        allocations: [al],
      });
      expect(p.id).toBe("pay-x");
      expect(p.status).toBe("POSTED");
      expect(p.allocations.length).toBe(1);
      expect(p.allocations[0].id).toBe("alloc-1");
      expect(p.journalEntryId).toBe("je-1");
    });
  });

  describe("post()", () => {
    it("DRAFT → POSTED returns a new instance with status POSTED", async () => {
      const p = Payment.create(baseInput);
      await new Promise((resolve) => setTimeout(resolve, 5));
      const posted = p.post();
      expect(posted).not.toBe(p);
      expect(posted.status).toBe("POSTED");
      expect(p.status).toBe("DRAFT");
      expect(posted.updatedAt.getTime()).toBeGreaterThan(p.updatedAt.getTime());
    });

    // Failure mode declarado: InvalidPaymentStatusTransition (validation, INVALID_STATUS_TRANSITION).
    it("POSTED → POSTED throws InvalidPaymentStatusTransition", () => {
      const p = Payment.create(baseInput).post();
      expect(() => p.post()).toThrow(InvalidPaymentStatusTransition);
    });

    // Failure mode declarado: CannotModifyVoidedPayment (validation,
    // ENTRY_VOIDED_IMMUTABLE). Legacy parity (C2-FIX-2): VOIDED is terminal —
    // every transition out of VOIDED surfaces the SHARED ENTRY_VOIDED_IMMUTABLE
    // code, mirroring `validateTransition`'s first branch in
    // features/accounting/document-lifecycle.service.ts.
    it("VOIDED → POSTED throws CannotModifyVoidedPayment (ENTRY_VOIDED_IMMUTABLE)", () => {
      const p = Payment.create(baseInput).post().void();
      expect(() => p.post()).toThrow(CannotModifyVoidedPayment);
    });
  });

  describe("void()", () => {
    it("POSTED → VOIDED returns a new instance with status VOIDED", () => {
      const p = Payment.create(baseInput).post();
      const voided = p.void();
      expect(voided).not.toBe(p);
      expect(voided.status).toBe("VOIDED");
    });

    it("LOCKED → VOIDED is allowed", () => {
      const p = Payment.create(baseInput).post().lock();
      const voided = p.void();
      expect(voided.status).toBe("VOIDED");
    });

    // Failure mode declarado: InvalidPaymentStatusTransition (validation, INVALID_STATUS_TRANSITION).
    it("DRAFT → VOIDED throws InvalidPaymentStatusTransition", () => {
      const p = Payment.create(baseInput);
      expect(() => p.void()).toThrow(InvalidPaymentStatusTransition);
    });

    // Failure mode declarado: CannotModifyVoidedPayment (validation,
    // ENTRY_VOIDED_IMMUTABLE). VOIDED → VOIDED, like every other transition
    // out of VOIDED, surfaces the SHARED ENTRY_VOIDED_IMMUTABLE code (C2-FIX-2
    // legacy parity). Previously this assertion accepted the generic
    // InvalidPaymentStatusTransition — wrong: legacy emits ENTRY_VOIDED_IMMUTABLE.
    it("VOIDED → VOIDED throws CannotModifyVoidedPayment (terminal state, ENTRY_VOIDED_IMMUTABLE)", () => {
      const p = Payment.create(baseInput).post().void();
      expect(() => p.void()).toThrow(CannotModifyVoidedPayment);
    });
  });

  describe("lock()", () => {
    it("POSTED → LOCKED returns new instance with status LOCKED", () => {
      const p = Payment.create(baseInput).post();
      const locked = p.lock();
      expect(locked.status).toBe("LOCKED");
    });

    // Failure mode declarado: InvalidPaymentStatusTransition.
    it("DRAFT → LOCKED throws InvalidPaymentStatusTransition", () => {
      const p = Payment.create(baseInput);
      expect(() => p.lock()).toThrow(InvalidPaymentStatusTransition);
    });

    it("LOCKED → LOCKED throws InvalidPaymentStatusTransition", () => {
      const p = Payment.create(baseInput).post().lock();
      expect(() => p.lock()).toThrow(InvalidPaymentStatusTransition);
    });
  });

  describe("update()", () => {
    it("updates description without touching amount or allocations", () => {
      const p = Payment.create({
        ...baseInput,
        allocations: [
          { target: AllocationTarget.forReceivable("rec-1"), amount: 500 },
        ],
      });
      const updated = p.update({ description: "Editado" });
      expect(updated.description).toBe("Editado");
      expect(updated.amount.value).toBe(p.amount.value);
      expect(updated.allocations.length).toBe(1);
    });

    it("updates amount when provided", () => {
      const p = Payment.create(baseInput);
      const updated = p.update({ amount: 2000 });
      expect(updated.amount.value).toBe(2000);
    });

    it("updates date when provided", () => {
      const p = Payment.create(baseInput);
      const newDate = new Date("2026-12-31");
      const updated = p.update({ date: newDate });
      expect(updated.date.getTime()).toBe(newDate.getTime());
    });

    it("returns a new instance (immutable)", () => {
      const p = Payment.create(baseInput);
      const updated = p.update({ description: "z" });
      expect(updated).not.toBe(p);
      expect(p.description).toBe("Cobro factura 0001");
    });

    it("bumps updatedAt", async () => {
      const p = Payment.create(baseInput);
      await new Promise((resolve) => setTimeout(resolve, 5));
      const updated = p.update({ description: "z" });
      expect(updated.updatedAt.getTime()).toBeGreaterThan(p.updatedAt.getTime());
    });

    it("allows clearing optional fields with null", () => {
      const p = Payment.create({ ...baseInput, notes: "x" });
      const updated = p.update({ notes: null });
      expect(updated.notes).toBeNull();
    });

    // Failure mode declarado: PaymentAllocationsExceedTotal — bajar el monto por
    // debajo de SUM(allocations) viola la invariante.
    it("rejects amount reduction below current allocation sum", () => {
      const p = Payment.create({
        ...baseInput,
        amount: 1000,
        allocations: [
          { target: AllocationTarget.forReceivable("rec-1"), amount: 600 },
        ],
      });
      expect(() => p.update({ amount: 500 })).toThrow(
        PaymentAllocationsExceedTotal,
      );
    });

    // Failure mode declarado: CannotModifyVoidedPayment (validation, PAYMENT_VOIDED_IMMUTABLE).
    it("rejects update on VOIDED payment with CannotModifyVoidedPayment", () => {
      const p = Payment.create(baseInput).post().void();
      expect(() => p.update({ description: "x" })).toThrow(
        CannotModifyVoidedPayment,
      );
    });
  });

  describe("replaceAllocations()", () => {
    it("replaces the full allocation list", () => {
      const p = Payment.create({
        ...baseInput,
        allocations: [
          { target: AllocationTarget.forReceivable("rec-1"), amount: 500 },
        ],
      });
      const next = p.replaceAllocations([
        alloc(AllocationTarget.forReceivable("rec-2"), 300, p.id),
        alloc(AllocationTarget.forReceivable("rec-3"), 700, p.id),
      ]);
      expect(next.allocations.length).toBe(2);
      expect(next.allocations[0].receivableId).toBe("rec-2");
      expect(next.allocations[1].receivableId).toBe("rec-3");
    });

    it("returns a new instance and bumps updatedAt", async () => {
      const p = Payment.create(baseInput);
      await new Promise((resolve) => setTimeout(resolve, 5));
      const next = p.replaceAllocations([
        alloc(AllocationTarget.forReceivable("rec-1"), 1000, p.id),
      ]);
      expect(next).not.toBe(p);
      expect(next.updatedAt.getTime()).toBeGreaterThan(p.updatedAt.getTime());
    });

    // Failure mode declarado: PaymentAllocationsExceedTotal.
    it("rejects when sum > amount with PaymentAllocationsExceedTotal", () => {
      const p = Payment.create({ ...baseInput, amount: 1000 });
      expect(() =>
        p.replaceAllocations([
          alloc(AllocationTarget.forReceivable("rec-1"), 1000.01, p.id),
        ]),
      ).toThrow(PaymentAllocationsExceedTotal);
    });

    // Failure mode declarado: PaymentMixedAllocation.
    it("rejects mixed receivable+payable with PaymentMixedAllocation", () => {
      const p = Payment.create({ ...baseInput, amount: 1000 });
      expect(() =>
        p.replaceAllocations([
          alloc(AllocationTarget.forReceivable("rec-1"), 400, p.id),
          alloc(AllocationTarget.forPayable("pay-1"), 400, p.id),
        ]),
      ).toThrow(PaymentMixedAllocation);
    });

    it("accepts an empty allocation list (clears all)", () => {
      const p = Payment.create({
        ...baseInput,
        allocations: [
          { target: AllocationTarget.forReceivable("rec-1"), amount: 500 },
        ],
      });
      const next = p.replaceAllocations([]);
      expect(next.allocations).toEqual([]);
    });

    // Failure mode declarado: CannotModifyVoidedPayment (validation, PAYMENT_VOIDED_IMMUTABLE).
    it("rejects on VOIDED payment with CannotModifyVoidedPayment", () => {
      const p = Payment.create(baseInput).post().void();
      expect(() => p.replaceAllocations([])).toThrow(
        CannotModifyVoidedPayment,
      );
    });
  });

  describe("applyCreditAllocation()", () => {
    it("appends an allocation when funds are available", () => {
      const p = Payment.create({ ...baseInput, amount: 1000 }); // 1000 unapplied
      const next = p.applyCreditAllocation(
        alloc(AllocationTarget.forReceivable("rec-1"), 400, p.id),
      );
      expect(next.allocations.length).toBe(1);
      expect(next.allocations[0].receivableId).toBe("rec-1");
      expect(next.unappliedAmount.value).toBe(600);
    });

    // Failure mode declarado: PaymentAllocationsExceedTotal — exceder fondos disponibles.
    it("rejects when allocation > unapplied amount with PaymentAllocationsExceedTotal", () => {
      const p = Payment.create({ ...baseInput, amount: 100 });
      expect(() =>
        p.applyCreditAllocation(
          alloc(AllocationTarget.forReceivable("rec-1"), 100.01, p.id),
        ),
      ).toThrow(PaymentAllocationsExceedTotal);
    });

    // Failure mode declarado: PaymentMixedAllocation — agregar payable a un payment con receivables.
    it("rejects mixing direction against existing allocations with PaymentMixedAllocation", () => {
      const p = Payment.create({
        ...baseInput,
        allocations: [
          { target: AllocationTarget.forReceivable("rec-1"), amount: 200 },
        ],
      });
      expect(() =>
        p.applyCreditAllocation(
          alloc(AllocationTarget.forPayable("pay-1"), 100, p.id),
        ),
      ).toThrow(PaymentMixedAllocation);
    });

    // Failure mode declarado: CannotModifyVoidedPayment (validation, PAYMENT_VOIDED_IMMUTABLE).
    it("rejects on VOIDED payment with CannotModifyVoidedPayment", () => {
      const p = Payment.create(baseInput).post().void();
      expect(() =>
        p.applyCreditAllocation(
          alloc(AllocationTarget.forReceivable("rec-1"), 100, p.id),
        ),
      ).toThrow(CannotModifyVoidedPayment);
    });

    it("returns a new instance and bumps updatedAt", async () => {
      const p = Payment.create({ ...baseInput, amount: 1000 });
      await new Promise((resolve) => setTimeout(resolve, 5));
      const next = p.applyCreditAllocation(
        alloc(AllocationTarget.forReceivable("rec-1"), 100, p.id),
      );
      expect(next).not.toBe(p);
      expect(next.updatedAt.getTime()).toBeGreaterThan(p.updatedAt.getTime());
    });
  });

  describe("linkJournalEntry()", () => {
    it("sets the journalEntryId on a non-voided payment", () => {
      const p = Payment.create(baseInput).post();
      const linked = p.linkJournalEntry("je-1");
      expect(linked.journalEntryId).toBe("je-1");
    });

    // Failure mode declarado: CannotModifyVoidedPayment.
    it("rejects on VOIDED payment with CannotModifyVoidedPayment", () => {
      const p = Payment.create(baseInput).post().void();
      expect(() => p.linkJournalEntry("je-1")).toThrow(
        CannotModifyVoidedPayment,
      );
    });

    it("returns a new instance", () => {
      const p = Payment.create(baseInput).post();
      const linked = p.linkJournalEntry("je-1");
      expect(linked).not.toBe(p);
      expect(p.journalEntryId).toBeNull();
    });
  });

  describe("derived properties", () => {
    it("totalAllocated sums allocation amounts", () => {
      const p = Payment.create({
        ...baseInput,
        allocations: [
          { target: AllocationTarget.forReceivable("rec-1"), amount: 300 },
          { target: AllocationTarget.forReceivable("rec-2"), amount: 200 },
        ],
      });
      expect(p.totalAllocated.value).toBe(500);
    });

    it("unappliedAmount = amount - totalAllocated", () => {
      const p = Payment.create({
        ...baseInput,
        amount: 1000,
        allocations: [
          { target: AllocationTarget.forReceivable("rec-1"), amount: 250 },
        ],
      });
      expect(p.unappliedAmount.value).toBe(750);
    });

    it("totalAllocated is zero when there are no allocations", () => {
      const p = Payment.create(baseInput);
      expect(p.totalAllocated.value).toBe(0);
      expect(p.unappliedAmount.value).toBe(p.amount.value);
    });

    it("direction returns COBRO when first allocation is receivable", () => {
      const p = Payment.create({
        ...baseInput,
        allocations: [
          { target: AllocationTarget.forReceivable("rec-1"), amount: 100 },
        ],
      });
      expect(p.direction).toBe("COBRO");
    });

    it("direction returns PAGO when first allocation is payable", () => {
      const p = Payment.create({
        ...baseInput,
        allocations: [
          { target: AllocationTarget.forPayable("pay-1"), amount: 100 },
        ],
      });
      expect(p.direction).toBe("PAGO");
    });

    it("direction is null when there are no allocations", () => {
      const p = Payment.create(baseInput);
      expect(p.direction).toBeNull();
    });
  });

  describe("toSnapshot()", () => {
    it("returns a POJO with monetary fields as numbers and allocation snapshots", () => {
      const p = Payment.create({
        ...baseInput,
        allocations: [
          { target: AllocationTarget.forReceivable("rec-1"), amount: 250.5 },
        ],
      });
      const snap = p.toSnapshot();
      expect(typeof snap.amount).toBe("number");
      expect(snap.amount).toBe(1000);
      expect(snap.allocations.length).toBe(1);
      expect(typeof snap.allocations[0].amount).toBe("number");
      expect(snap.allocations[0].amount).toBe(250.5);
      expect(snap.allocations[0].receivableId).toBe("rec-1");
    });

    it("preserves ids, status and dates", () => {
      const p = Payment.create(baseInput);
      const snap = p.toSnapshot();
      expect(snap.id).toBe(p.id);
      expect(snap.organizationId).toBe("org-1");
      expect(snap.status).toBe("DRAFT");
      expect(snap.createdAt).toBeInstanceOf(Date);
      expect(snap.updatedAt).toBeInstanceOf(Date);
    });
  });
});
