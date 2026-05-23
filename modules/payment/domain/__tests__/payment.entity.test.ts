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
  CreditAllocationNotFound,
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

    // ── Atomic update() with allocations (fix-payment-amount-reduce-invariant) ──
    // The invariant `sum(allocations) <= amount` is now evaluated against the
    // FINAL aggregate state: when the caller supplies new allocations alongside
    // a new amount, BOTH are applied before enforceAllocationInvariants runs.

    // Failure mode declarado: PaymentAllocationsExceedTotal (pre-fix update()
    // ignores input.allocations and checks OLD sum 600 vs NEW amount 500). After
    // the fix, NEW allocations (sum 500) vs NEW amount 500 → must NOT throw.
    it("reduces amount when new lower allocations summing to new amount are supplied", () => {
      const p = Payment.create({
        ...baseInput,
        amount: 1000,
        allocations: [
          { target: AllocationTarget.forReceivable("rec-1"), amount: 600 },
        ],
      });
      const updated = p.update({
        amount: 500,
        allocations: [
          alloc(AllocationTarget.forReceivable("rec-1"), 500, p.id),
        ],
      });
      expect(updated.amount.value).toBe(500);
      expect(updated.totalAllocated.value).toBe(500);
      expect(updated.allocations).toHaveLength(1);
    });

    // Failure mode declarado: PaymentAllocationsExceedTotal — final-state check.
    // NOTE (honest classification): this throws BOTH pre-fix and post-fix, but
    // for DIFFERENT reasons. Pre-fix: OLD allocs (sum 600) vs NEW amount 500.
    // Post-fix: NEW allocs (sum 600) vs NEW amount 500. It is therefore a GREEN
    // regression-guard (invariant still enforced on the final state), NOT a RED.
    it("rejects new allocations summing above the new amount", () => {
      const p = Payment.create({
        ...baseInput,
        amount: 1000,
        allocations: [
          { target: AllocationTarget.forReceivable("rec-1"), amount: 600 },
        ],
      });
      expect(() =>
        p.update({
          amount: 500,
          allocations: [
            alloc(AllocationTarget.forReceivable("rec-1"), 600, p.id),
          ],
        }),
      ).toThrow(PaymentAllocationsExceedTotal);
    });

    // Failure mode declarado: PaymentAllocationsExceedTotal (increase path also
    // broken pre-fix — OLD allocs are checked against the new amount, but here
    // the symmetry case proves the final-state semantics: NEW allocs sum 700 ==
    // NEW amount 700 must pass).
    it("increases amount with higher allocations summing to the new amount (symmetry)", () => {
      const p = Payment.create({
        ...baseInput,
        amount: 500,
        allocations: [
          { target: AllocationTarget.forReceivable("rec-1"), amount: 500 },
        ],
      });
      const updated = p.update({
        amount: 700,
        allocations: [
          alloc(AllocationTarget.forReceivable("rec-1"), 700, p.id),
        ],
      });
      expect(updated.amount.value).toBe(700);
      expect(updated.totalAllocated.value).toBe(700);
    });

    // Failure mode declarado: CannotModifyVoidedPayment (validation, PAYMENT_VOIDED_IMMUTABLE).
    it("rejects update on VOIDED payment with CannotModifyVoidedPayment", () => {
      const p = Payment.create(baseInput).post().void();
      expect(() => p.update({ description: "x" })).toThrow(
        CannotModifyVoidedPayment,
      );
    });

    // W1 — increase with HEADROOM (sum < amount): proves update() accepts new
    // allocations whose sum is STRICTLY LESS than the new amount. The invariant
    // uses isGreaterThan, so sum<amount and sum==amount exit the same non-throwing
    // path; this test names the headroom variant explicitly.
    it("increases amount with allocations whose sum is strictly less than the new amount (headroom)", () => {
      const p = Payment.create({
        ...baseInput,
        amount: 500,
        allocations: [
          { target: AllocationTarget.forReceivable("rec-1"), amount: 500 },
        ],
      });
      const updated = p.update({
        amount: 1000,
        allocations: [
          alloc(AllocationTarget.forReceivable("rec-1"), 800, p.id),
        ],
      });
      expect(updated.amount.value).toBe(1000);
      expect(updated.totalAllocated.value).toBe(800);
      expect(updated.unappliedAmount.value).toBe(200);
      expect(updated.allocations).toHaveLength(1);
    });

    // W2 — mixed targets via update(): proves enforceAllocationInvariants runs on
    // the NEW allocations supplied to update(), not only via replaceAllocations.
    // Failure mode declarado: PaymentMixedAllocation (validation, PAYMENT_MIXED_ALLOCATION).
    it("rejects mixed receivable+payable allocations supplied via update() with PaymentMixedAllocation", () => {
      const p = Payment.create({
        ...baseInput,
        amount: 1000,
        allocations: [
          { target: AllocationTarget.forReceivable("rec-1"), amount: 600 },
        ],
      });
      expect(() =>
        p.update({
          amount: 1000,
          allocations: [
            alloc(AllocationTarget.forReceivable("rec-1"), 500, p.id),
            alloc(AllocationTarget.forPayable("pay-1"), 500, p.id),
          ],
        }),
      ).toThrow(PaymentMixedAllocation);
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

    // ── D3 cross-direction credit sentinel (pago-credit-system task 2.4) ──
    // A COBRO source (existing RECEIVABLE allocation) cannot apply credit to a
    // PAYABLE target: enforceAllocationInvariants rejects the mixed set with
    // PaymentMixedAllocation BEFORE any balance mutation. This is the existing
    // aggregate invariant (design D3, payment.entity.ts enforceAllocationInvariants)
    // covering the credit path — EXPECTED GREEN by the pre-existing guard, NOT a
    // new behavior. If this ever goes RED, the guard stopped evaluating the
    // credit-source direction against the proposed target direction.
    it("[D3 sentinel] COBRO source applying credit to a PAYABLE target throws PaymentMixedAllocation", () => {
      const cobroSource = Payment.create({
        ...baseInput,
        amount: 1000,
        allocations: [
          { target: AllocationTarget.forReceivable("rec-1"), amount: 300 },
        ],
      });
      expect(() =>
        cobroSource.applyCreditAllocation(
          alloc(AllocationTarget.forPayable("pay-1"), 100, cobroSource.id),
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

  // ── didCashChange (Phase 2 — REQ-PAY-2 journal↔matching seam) ──────────────
  // Pure domain predicate: returns whether any cash-affecting field (amount,
  // method, date, accountCode) of the proposed edit differs from the current
  // persisted aggregate. The application layer branches the journal void/regen
  // on this (Scenario E: cash unchanged → journal untouched).
  describe("didCashChange()", () => {
    const cashBase = {
      ...baseInput,
      amount: 100,
      method: "EFECTIVO" as const,
      date: new Date("2026-04-15T00:00:00Z"),
      accountCode: "1.1.1.1",
    };

    it("returns false when no cash field changes (empty input)", () => {
      const p = Payment.create(cashBase);
      expect(p.didCashChange({})).toBe(false);
    });

    it("returns false when cash fields match current values", () => {
      const p = Payment.create(cashBase);
      expect(
        p.didCashChange({
          amount: 100,
          method: "EFECTIVO",
          date: new Date("2026-04-15T00:00:00Z"),
          accountCode: "1.1.1.1",
        }),
      ).toBe(false); // every field equals current → no cash change
    });

    it("returns true when amount differs", () => {
      const p = Payment.create(cashBase);
      expect(p.didCashChange({ amount: 200 })).toBe(true);
    });

    it("returns false when amount equals via MonetaryAmount (100 vs '100.00')", () => {
      const p = Payment.create(cashBase);
      expect(p.didCashChange({ amount: "100.00" })).toBe(false);
    });

    it("returns true when method differs", () => {
      const p = Payment.create(cashBase);
      expect(p.didCashChange({ method: "TRANSFERENCIA" })).toBe(true);
    });

    it("returns false when method equals current", () => {
      const p = Payment.create(cashBase);
      expect(p.didCashChange({ method: "EFECTIVO" })).toBe(false);
    });

    it("returns true when date differs", () => {
      const p = Payment.create(cashBase);
      expect(
        p.didCashChange({ date: new Date("2026-05-01T00:00:00Z") }),
      ).toBe(true);
    });

    it("returns false when date equals current (compared by getTime)", () => {
      const p = Payment.create(cashBase);
      expect(
        p.didCashChange({ date: new Date("2026-04-15T00:00:00Z") }),
      ).toBe(false);
    });

    it("returns true when accountCode differs", () => {
      const p = Payment.create(cashBase);
      expect(p.didCashChange({ accountCode: "1.1.2.1" })).toBe(true);
    });

    it("returns false when accountCode equals current", () => {
      const p = Payment.create(cashBase);
      expect(p.didCashChange({ accountCode: "1.1.1.1" })).toBe(false);
    });

    it("returns true when accountCode changes from null to a value", () => {
      const p = Payment.create({ ...cashBase, accountCode: null });
      expect(p.didCashChange({ accountCode: "1.1.1.1" })).toBe(true);
    });
  });

  // ── removeCreditAllocation (Phase 2 — inverse of applyCreditAllocation) ────
  // Used by the trivial revertCreditTx (design v2 §CENTERPIECE). Removes ONE
  // credit-application allocation from the SOURCE payment, matched by the R-3
  // triple key (sourcePaymentId + receivableId + amount) to disambiguate equal
  // credits from different sources. Re-runs enforceAllocationInvariants;
  // restores unappliedAmount.
  describe("removeCreditAllocation()", () => {
    // A source payment with amount 300 and two RECEIVABLE allocations:
    //  - rec-a / 100  and  rec-b / 100  → unappliedAmount = 100
    function makeSourceWithTwoCredits(): Payment {
      return Payment.create({
        ...baseInput,
        amount: 300,
        allocations: [
          { target: AllocationTarget.forReceivable("rec-a"), amount: 100 },
          { target: AllocationTarget.forReceivable("rec-b"), amount: 100 },
        ],
      });
    }

    it("removes the matching credit allocation by triple key", () => {
      const source = makeSourceWithTwoCredits();
      const updated = source.removeCreditAllocation(
        source.id,
        AllocationTarget.forReceivable("rec-a"),
        MonetaryAmount.of(100),
      );
      expect(updated.allocations).toHaveLength(1);
      expect(updated.allocations[0].receivableId).toBe("rec-b");
    });

    it("restores unappliedAmount by the removed amount", () => {
      const source = makeSourceWithTwoCredits();
      expect(source.unappliedAmount.value).toBe(100);
      const updated = source.removeCreditAllocation(
        source.id,
        AllocationTarget.forReceivable("rec-a"),
        MonetaryAmount.of(100),
      );
      expect(updated.unappliedAmount.value).toBe(200);
    });

    it("does not mutate the original aggregate (immutability)", () => {
      const source = makeSourceWithTwoCredits();
      source.removeCreditAllocation(
        source.id,
        AllocationTarget.forReceivable("rec-a"),
        MonetaryAmount.of(100),
      );
      expect(source.allocations).toHaveLength(2);
    });

    it("throws CreditAllocationNotFound when no allocation matches the target", () => {
      const source = makeSourceWithTwoCredits();
      expect(() =>
        source.removeCreditAllocation(
          source.id,
          AllocationTarget.forReceivable("rec-missing"),
          MonetaryAmount.of(100),
        ),
      ).toThrow(CreditAllocationNotFound);
    });

    it("throws CreditAllocationNotFound when the target matches but amount differs", () => {
      const source = makeSourceWithTwoCredits();
      expect(() =>
        source.removeCreditAllocation(
          source.id,
          AllocationTarget.forReceivable("rec-a"),
          MonetaryAmount.of(50),
        ),
      ).toThrow(CreditAllocationNotFound);
    });

    it("throws CreditAllocationNotFound when sourcePaymentId does not match this aggregate (R-3 guard)", () => {
      const source = makeSourceWithTwoCredits();
      expect(() =>
        source.removeCreditAllocation(
          "some-other-source",
          AllocationTarget.forReceivable("rec-a"),
          MonetaryAmount.of(100),
        ),
      ).toThrow(CreditAllocationNotFound);
    });

    // R-3: two equal-amount credits to the SAME receivable but accounted as
    // distinct rows. Removing one (amount 100) leaves exactly the other 100,
    // proving the match removes ONE row, not all matching rows.
    it("removes only ONE row when two equal credits target the same receivable (R-3)", () => {
      const source = Payment.create({
        ...baseInput,
        amount: 300,
        allocations: [
          { target: AllocationTarget.forReceivable("rec-dup"), amount: 100 },
          { target: AllocationTarget.forReceivable("rec-dup"), amount: 100 },
        ],
      });
      const updated = source.removeCreditAllocation(
        source.id,
        AllocationTarget.forReceivable("rec-dup"),
        MonetaryAmount.of(100),
      );
      expect(updated.allocations).toHaveLength(1);
      expect(updated.allocations[0].receivableId).toBe("rec-dup");
      expect(updated.allocations[0].amount.value).toBe(100);
    });

    it("throws CannotModifyVoidedPayment when the source is VOIDED", () => {
      const source = makeSourceWithTwoCredits();
      const voided = source.post().void();
      expect(() =>
        voided.removeCreditAllocation(
          voided.id,
          AllocationTarget.forReceivable("rec-a"),
          MonetaryAmount.of(100),
        ),
      ).toThrow(CannotModifyVoidedPayment);
    });

    // ── Phase 2 (pago-credit-system): match by AllocationTarget, not
    // receivableId-only. A PAGO credit link carries payableId; removeCredit
    // must dispatch on the target VO (XOR by construction), mirroring the
    // applyAllocationTx receivables|payables dispatch.
    describe("matches by AllocationTarget (payable target)", () => {
      // amount 300, two PAYABLE allocations → unappliedAmount = 100.
      function makeSourceWithTwoPayableCredits(): Payment {
        return Payment.create({
          ...baseInput,
          amount: 300,
          allocations: [
            { target: AllocationTarget.forPayable("pay-a"), amount: 100 },
            { target: AllocationTarget.forPayable("pay-b"), amount: 100 },
          ],
        });
      }

      it("removes the credit allocation matching a payable target", () => {
        const source = makeSourceWithTwoPayableCredits();
        const updated = source.removeCreditAllocation(
          source.id,
          AllocationTarget.forPayable("pay-a"),
          MonetaryAmount.of(100),
        );
        expect(updated.allocations).toHaveLength(1);
        expect(updated.allocations[0].payableId).toBe("pay-b");
        expect(updated.allocations[0].receivableId).toBeNull();
      });

      it("restores unappliedAmount when a payable credit is removed", () => {
        const source = makeSourceWithTwoPayableCredits();
        expect(source.unappliedAmount.value).toBe(100);
        const updated = source.removeCreditAllocation(
          source.id,
          AllocationTarget.forPayable("pay-a"),
          MonetaryAmount.of(100),
        );
        expect(updated.unappliedAmount.value).toBe(200);
      });

      it("does not match a receivable target against a payable allocation of the same id", () => {
        const source = Payment.create({
          ...baseInput,
          amount: 300,
          allocations: [
            { target: AllocationTarget.forPayable("x"), amount: 100 },
          ],
        });
        // AllocationTarget.forReceivable("x") must NOT match forPayable("x") —
        // the VO equality is kind-sensitive (XOR), not id-only.
        expect(() =>
          source.removeCreditAllocation(
            source.id,
            AllocationTarget.forReceivable("x"),
            MonetaryAmount.of(100),
          ),
        ).toThrow(CreditAllocationNotFound);
      });

      it("throws CreditAllocationNotFound when no payable target matches", () => {
        const source = makeSourceWithTwoPayableCredits();
        expect(() =>
          source.removeCreditAllocation(
            source.id,
            AllocationTarget.forPayable("pay-missing"),
            MonetaryAmount.of(100),
          ),
        ).toThrow(CreditAllocationNotFound);
      });
    });
  });
});
