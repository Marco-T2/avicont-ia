import { describe, it, expect } from "vitest";
import { Payable } from "../payable.entity";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import { InvalidMonetaryAmount } from "@/modules/shared/domain/errors/monetary-errors";
import {
  InvalidPayableStatusTransition,
  PartialPaymentAmountRequired,
  AllocationMustBePositive,
  RevertMustBePositive,
  AllocationExceedsBalance,
  RevertExceedsPaid,
  CannotApplyToVoidedPayable,
  CannotRevertOnVoidedPayable,
} from "../errors/payable-errors";

const baseInput = {
  organizationId: "org-1",
  contactId: "contact-1",
  description: "Factura proveedor 0001",
  amount: 1000,
  dueDate: new Date("2026-05-15T00:00:00Z"),
};

describe("Payable entity", () => {
  describe("create()", () => {
    it("returns a payable with status PENDING and balance = amount", () => {
      const p = Payable.create(baseInput);
      expect(p.status).toBe("PENDING");
      expect(p.amount.value).toBe(1000);
      expect(p.paid.value).toBe(0);
      expect(p.balance.value).toBe(1000);
    });

    it("assigns a UUID id", () => {
      const p = Payable.create(baseInput);
      expect(p.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it("assigns createdAt and updatedAt to the same instant", () => {
      const p = Payable.create(baseInput);
      expect(p.createdAt.getTime()).toBe(p.updatedAt.getTime());
    });

    it("preserves contact id, description and due date", () => {
      const p = Payable.create(baseInput);
      expect(p.contactId).toBe("contact-1");
      expect(p.description).toBe("Factura proveedor 0001");
      expect(p.dueDate.getTime()).toBe(baseInput.dueDate.getTime());
    });

    it("optional fields default to null", () => {
      const p = Payable.create(baseInput);
      expect(p.sourceType).toBeNull();
      expect(p.sourceId).toBeNull();
      expect(p.journalEntryId).toBeNull();
      expect(p.notes).toBeNull();
    });

    it("propagates optional fields when provided", () => {
      const p = Payable.create({
        ...baseInput,
        sourceType: "purchase",
        sourceId: "purch-1",
        journalEntryId: "je-1",
        notes: "x",
      });
      expect(p.sourceType).toBe("purchase");
      expect(p.sourceId).toBe("purch-1");
      expect(p.journalEntryId).toBe("je-1");
      expect(p.notes).toBe("x");
    });

    it("rejects negative amount via MonetaryAmount", () => {
      expect(() => Payable.create({ ...baseInput, amount: -1 })).toThrow(InvalidMonetaryAmount);
    });

    it("accepts string amount and normalizes to number", () => {
      const p = Payable.create({ ...baseInput, amount: "1234.56" });
      expect(p.amount.value).toBe(1234.56);
    });
  });

  describe("fromPersistence()", () => {
    it("hydrates without re-validating amount > 0", () => {
      const p = Payable.fromPersistence({
        id: "pay-1",
        organizationId: "org-1",
        contactId: "contact-1",
        description: "x",
        amount: MonetaryAmount.of(500),
        paid: MonetaryAmount.of(200),
        balance: MonetaryAmount.of(300),
        dueDate: new Date("2026-06-01"),
        status: "PARTIAL",
        sourceType: null,
        sourceId: null,
        journalEntryId: null,
        notes: null,
        createdAt: new Date("2026-04-01"),
        updatedAt: new Date("2026-04-15"),
      });
      expect(p.id).toBe("pay-1");
      expect(p.status).toBe("PARTIAL");
      expect(p.paid.value).toBe(200);
      expect(p.balance.value).toBe(300);
    });
  });

  describe("update()", () => {
    it("updates description without touching monetary fields", () => {
      const p = Payable.create(baseInput);
      const updated = p.update({ description: "Factura editada" });
      expect(updated.description).toBe("Factura editada");
      expect(updated.amount.value).toBe(p.amount.value);
      expect(updated.paid.value).toBe(p.paid.value);
      expect(updated.balance.value).toBe(p.balance.value);
    });

    it("updates dueDate", () => {
      const p = Payable.create(baseInput);
      const newDue = new Date("2026-12-31T00:00:00Z");
      const updated = p.update({ dueDate: newDue });
      expect(updated.dueDate.getTime()).toBe(newDue.getTime());
    });

    it("returns a new instance (immutable)", () => {
      const p = Payable.create(baseInput);
      const updated = p.update({ description: "z" });
      expect(updated).not.toBe(p);
      expect(p.description).toBe("Factura proveedor 0001");
    });

    it("bumps updatedAt", async () => {
      const p = Payable.create(baseInput);
      await new Promise((resolve) => setTimeout(resolve, 5));
      const updated = p.update({ description: "z" });
      expect(updated.updatedAt.getTime()).toBeGreaterThan(p.updatedAt.getTime());
    });

    it("allows clearing optional fields with null", () => {
      const p = Payable.create({ ...baseInput, notes: "x" });
      const updated = p.update({ notes: null });
      expect(updated.notes).toBeNull();
    });
  });

  describe("transitionTo()", () => {
    it("PENDING → PAID sets paid=amount and balance=0", () => {
      const p = Payable.create(baseInput);
      const paid = p.transitionTo("PAID");
      expect(paid.status).toBe("PAID");
      expect(paid.paid.value).toBe(1000);
      expect(paid.balance.value).toBe(0);
    });

    it("PENDING → PARTIAL with paidAmount sets balance = amount - paid", () => {
      const p = Payable.create(baseInput);
      const partial = p.transitionTo("PARTIAL", 250);
      expect(partial.status).toBe("PARTIAL");
      expect(partial.paid.value).toBe(250);
      expect(partial.balance.value).toBe(750);
    });

    it("PENDING → PARTIAL without paidAmount throws PartialPaymentAmountRequired", () => {
      const p = Payable.create(baseInput);
      expect(() => p.transitionTo("PARTIAL")).toThrow(PartialPaymentAmountRequired);
    });

    it("PENDING → VOIDED keeps paid and sets balance=0", () => {
      const p = Payable.create(baseInput);
      const voided = p.transitionTo("VOIDED");
      expect(voided.status).toBe("VOIDED");
      expect(voided.paid.value).toBe(0);
      expect(voided.balance.value).toBe(0);
    });

    it("PARTIAL → VOIDED keeps prior paid and sets balance=0", () => {
      const p = Payable.create(baseInput).transitionTo("PARTIAL", 400);
      const voided = p.transitionTo("VOIDED");
      expect(voided.status).toBe("VOIDED");
      expect(voided.paid.value).toBe(400);
      expect(voided.balance.value).toBe(0);
    });

    it("PARTIAL → PAID sets paid=amount and balance=0", () => {
      const p = Payable.create(baseInput).transitionTo("PARTIAL", 400);
      const paid = p.transitionTo("PAID");
      expect(paid.paid.value).toBe(1000);
      expect(paid.balance.value).toBe(0);
    });

    it("PENDING → OVERDUE only changes status", () => {
      const p = Payable.create(baseInput);
      const overdue = p.transitionTo("OVERDUE");
      expect(overdue.status).toBe("OVERDUE");
      expect(overdue.paid.value).toBe(p.paid.value);
      expect(overdue.balance.value).toBe(p.balance.value);
    });

    it("PAID is terminal — any transition throws", () => {
      const p = Payable.create(baseInput).transitionTo("PAID");
      expect(() => p.transitionTo("PENDING")).toThrow(InvalidPayableStatusTransition);
      expect(() => p.transitionTo("PARTIAL", 100)).toThrow(InvalidPayableStatusTransition);
      expect(() => p.transitionTo("VOIDED")).toThrow(InvalidPayableStatusTransition);
    });

    it("VOIDED is terminal — any transition throws", () => {
      const p = Payable.create(baseInput).transitionTo("VOIDED");
      expect(() => p.transitionTo("PENDING")).toThrow(InvalidPayableStatusTransition);
      expect(() => p.transitionTo("PAID")).toThrow(InvalidPayableStatusTransition);
    });

    it("returns a new instance with bumped updatedAt", async () => {
      const p = Payable.create(baseInput);
      await new Promise((resolve) => setTimeout(resolve, 5));
      const next = p.transitionTo("PAID");
      expect(next).not.toBe(p);
      expect(next.updatedAt.getTime()).toBeGreaterThan(p.updatedAt.getTime());
    });
  });

  describe("void()", () => {
    it("is a shortcut for transitionTo('VOIDED')", () => {
      const p = Payable.create(baseInput);
      const voided = p.void();
      expect(voided.status).toBe("VOIDED");
      expect(voided.balance.value).toBe(0);
    });

    it("respects terminal-state guards", () => {
      const p = Payable.create(baseInput).transitionTo("PAID");
      expect(() => p.void()).toThrow(InvalidPayableStatusTransition);
    });
  });

  describe("applyAllocation()", () => {
    // Failure mode declarado: AllocationMustBePositive (validation, ALLOCATION_MUST_BE_POSITIVE).
    it("rejects amount of zero with AllocationMustBePositive", () => {
      const p = Payable.create(baseInput);
      expect(() => p.applyAllocation(MonetaryAmount.zero())).toThrow(AllocationMustBePositive);
    });

    // Failure mode declarado: CannotApplyToVoidedPayable (validation, CANNOT_APPLY_TO_VOIDED_PAYABLE).
    it("rejects on VOIDED payable with CannotApplyToVoidedPayable", () => {
      const p = Payable.create(baseInput).transitionTo("VOIDED");
      expect(() => p.applyAllocation(MonetaryAmount.of(100))).toThrow(CannotApplyToVoidedPayable);
    });

    // Failure mode declarado: AllocationExceedsBalance (validation, ALLOCATION_EXCEEDS_BALANCE).
    it("rejects when paid + amount exceeds total with AllocationExceedsBalance", () => {
      const p = Payable.create(baseInput); // total=1000, paid=0
      expect(() => p.applyAllocation(MonetaryAmount.of(1000.01))).toThrow(AllocationExceedsBalance);
    });

    // Failure mode declarado: AllocationExceedsBalance también desde estado PARTIAL.
    it("rejects when current paid + amount > total from PARTIAL", () => {
      const p = Payable.create(baseInput).transitionTo("PARTIAL", 800); // paid=800
      expect(() => p.applyAllocation(MonetaryAmount.of(201))).toThrow(AllocationExceedsBalance);
    });

    it("PENDING + full amount → PAID with paid=total and balance=0", () => {
      const p = Payable.create(baseInput);
      const next = p.applyAllocation(MonetaryAmount.of(1000));
      expect(next.status).toBe("PAID");
      expect(next.paid.value).toBe(1000);
      expect(next.balance.value).toBe(0);
    });

    it("PENDING + partial amount → PARTIAL with paid=amount and balance=remaining", () => {
      const p = Payable.create(baseInput);
      const next = p.applyAllocation(MonetaryAmount.of(300));
      expect(next.status).toBe("PARTIAL");
      expect(next.paid.value).toBe(300);
      expect(next.balance.value).toBe(700);
    });

    it("PARTIAL + closing amount → PAID", () => {
      const p = Payable.create(baseInput).transitionTo("PARTIAL", 600);
      const next = p.applyAllocation(MonetaryAmount.of(400));
      expect(next.status).toBe("PAID");
      expect(next.paid.value).toBe(1000);
      expect(next.balance.value).toBe(0);
    });

    it("PARTIAL + further partial → PARTIAL with accumulated paid", () => {
      const p = Payable.create(baseInput).transitionTo("PARTIAL", 300);
      const next = p.applyAllocation(MonetaryAmount.of(200));
      expect(next.status).toBe("PARTIAL");
      expect(next.paid.value).toBe(500);
      expect(next.balance.value).toBe(500);
    });

    it("returns a new instance (immutable)", () => {
      const p = Payable.create(baseInput);
      const next = p.applyAllocation(MonetaryAmount.of(100));
      expect(next).not.toBe(p);
      expect(p.paid.value).toBe(0);
      expect(p.status).toBe("PENDING");
    });

    it("bumps updatedAt", async () => {
      const p = Payable.create(baseInput);
      await new Promise((resolve) => setTimeout(resolve, 5));
      const next = p.applyAllocation(MonetaryAmount.of(100));
      expect(next.updatedAt.getTime()).toBeGreaterThan(p.updatedAt.getTime());
    });
  });

  describe("revertAllocation()", () => {
    // Failure mode declarado: RevertMustBePositive (validation, REVERT_MUST_BE_POSITIVE).
    it("rejects amount of zero with RevertMustBePositive", () => {
      const p = Payable.create(baseInput).transitionTo("PARTIAL", 300);
      expect(() => p.revertAllocation(MonetaryAmount.zero())).toThrow(RevertMustBePositive);
    });

    // Failure mode declarado: CannotRevertOnVoidedPayable (validation, CANNOT_REVERT_ON_VOIDED_PAYABLE).
    // Decisión arquitectónica: simetría apply/revert sobre VOIDED — ambos arrojan.
    it("rejects on VOIDED payable with CannotRevertOnVoidedPayable", () => {
      const p = Payable.create(baseInput).transitionTo("PARTIAL", 300).transitionTo("VOIDED");
      expect(() => p.revertAllocation(MonetaryAmount.of(100))).toThrow(CannotRevertOnVoidedPayable);
    });

    // Failure mode declarado: RevertExceedsPaid (validation, REVERT_EXCEEDS_PAID).
    it("rejects when amount > current paid with RevertExceedsPaid", () => {
      const p = Payable.create(baseInput).transitionTo("PARTIAL", 300);
      expect(() => p.revertAllocation(MonetaryAmount.of(300.01))).toThrow(RevertExceedsPaid);
    });

    it("PARTIAL + full revert (paid → 0) → OPEN (PENDING)", () => {
      const p = Payable.create(baseInput).transitionTo("PARTIAL", 300);
      const next = p.revertAllocation(MonetaryAmount.of(300));
      expect(next.status).toBe("PENDING");
      expect(next.paid.value).toBe(0);
      expect(next.balance.value).toBe(1000);
    });

    it("PARTIAL + partial revert → PARTIAL with reduced paid", () => {
      const p = Payable.create(baseInput).transitionTo("PARTIAL", 700);
      const next = p.revertAllocation(MonetaryAmount.of(200));
      expect(next.status).toBe("PARTIAL");
      expect(next.paid.value).toBe(500);
      expect(next.balance.value).toBe(500);
    });

    it("PAID + full revert → OPEN (PENDING) when paid → 0", () => {
      const p = Payable.create(baseInput).transitionTo("PAID");
      const next = p.revertAllocation(MonetaryAmount.of(1000));
      expect(next.status).toBe("PENDING");
      expect(next.paid.value).toBe(0);
      expect(next.balance.value).toBe(1000);
    });

    it("PAID + partial revert → PARTIAL with reduced paid", () => {
      const p = Payable.create(baseInput).transitionTo("PAID");
      const next = p.revertAllocation(MonetaryAmount.of(400));
      expect(next.status).toBe("PARTIAL");
      expect(next.paid.value).toBe(600);
      expect(next.balance.value).toBe(400);
    });

    it("returns a new instance (immutable)", () => {
      const p = Payable.create(baseInput).transitionTo("PARTIAL", 300);
      const next = p.revertAllocation(MonetaryAmount.of(100));
      expect(next).not.toBe(p);
      expect(p.paid.value).toBe(300);
      expect(p.status).toBe("PARTIAL");
    });

    it("bumps updatedAt", async () => {
      const p = Payable.create(baseInput).transitionTo("PARTIAL", 300);
      await new Promise((resolve) => setTimeout(resolve, 5));
      const next = p.revertAllocation(MonetaryAmount.of(100));
      expect(next.updatedAt.getTime()).toBeGreaterThan(p.updatedAt.getTime());
    });
  });

  describe("toSnapshot()", () => {
    it("returns a POJO with monetary fields as numbers", () => {
      const p = Payable.create(baseInput).transitionTo("PARTIAL", 250.5);
      const snap = p.toSnapshot();
      expect(typeof snap.amount).toBe("number");
      expect(typeof snap.paid).toBe("number");
      expect(typeof snap.balance).toBe("number");
      expect(snap.amount).toBe(1000);
      expect(snap.paid).toBe(250.5);
      expect(snap.balance).toBe(749.5);
    });

    it("preserves ids, status, dates and optional fields", () => {
      const p = Payable.create({ ...baseInput, sourceType: "purchase", sourceId: "p-1" });
      const snap = p.toSnapshot();
      expect(snap.id).toBe(p.id);
      expect(snap.organizationId).toBe("org-1");
      expect(snap.contactId).toBe("contact-1");
      expect(snap.status).toBe("PENDING");
      expect(snap.sourceType).toBe("purchase");
      expect(snap.sourceId).toBe("p-1");
      expect(snap.journalEntryId).toBeNull();
      expect(snap.notes).toBeNull();
      expect(snap.createdAt).toBeInstanceOf(Date);
      expect(snap.updatedAt).toBeInstanceOf(Date);
      expect(snap.dueDate.getTime()).toBe(baseInput.dueDate.getTime());
    });
  });

  describe("changeContact() — purchase-hex editPosted contact change", () => {
    it("returns a new Payable with updated contactId", () => {
      const p = Payable.create(baseInput);
      const updated = p.changeContact("contact-2");

      expect(updated.contactId).toBe("contact-2");
      expect(updated.id).toBe(p.id);
      expect(updated.amount.value).toBe(p.amount.value);
    });

    it("preserves the original instance (immutability)", () => {
      const p = Payable.create(baseInput);
      const updated = p.changeContact("contact-2");

      expect(p.contactId).toBe("contact-1");
      expect(updated).not.toBe(p);
    });
  });

  describe("recomputeForPurchaseEdit() — purchase total mutation", () => {
    it("caps paid at newTotal when paid > newTotal (status PAID)", () => {
      const p = Payable.create(baseInput).applyAllocation(MonetaryAmount.of(800));
      const updated = p.recomputeForPurchaseEdit(MonetaryAmount.of(500));

      expect(updated.amount.value).toBe(500);
      expect(updated.paid.value).toBe(500);
      expect(updated.balance.value).toBe(0);
      expect(updated.status).toBe("PAID");
    });

    it("preserves paid when paid <= newTotal (status PARTIAL)", () => {
      const p = Payable.create(baseInput).applyAllocation(MonetaryAmount.of(300));
      const updated = p.recomputeForPurchaseEdit(MonetaryAmount.of(700));

      expect(updated.amount.value).toBe(700);
      expect(updated.paid.value).toBe(300);
      expect(updated.balance.value).toBe(400);
      expect(updated.status).toBe("PARTIAL");
    });

    it("status PENDING when paid is zero (no allocations applied)", () => {
      const p = Payable.create(baseInput);
      const updated = p.recomputeForPurchaseEdit(MonetaryAmount.of(2000));

      expect(updated.amount.value).toBe(2000);
      expect(updated.paid.value).toBe(0);
      expect(updated.balance.value).toBe(2000);
      expect(updated.status).toBe("PENDING");
    });

    it("status PAID when paid equals newTotal exactly", () => {
      const p = Payable.create(baseInput).applyAllocation(MonetaryAmount.of(500));
      const updated = p.recomputeForPurchaseEdit(MonetaryAmount.of(500));

      expect(updated.amount.value).toBe(500);
      expect(updated.paid.value).toBe(500);
      expect(updated.balance.value).toBe(0);
      expect(updated.status).toBe("PAID");
    });

    it("returns a new Payable instance (immutability)", () => {
      const p = Payable.create(baseInput);
      const updated = p.recomputeForPurchaseEdit(MonetaryAmount.of(500));

      expect(updated).not.toBe(p);
      expect(p.amount.value).toBe(1000);
    });
  });
});
