import { describe, it, expect } from "vitest";
import { Payable } from "../payable.entity";
import { MonetaryAmount } from "../value-objects/monetary-amount";
import {
  InvalidPayableStatusTransition,
  PartialPaymentAmountRequired,
  InvalidMonetaryAmount,
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
});
