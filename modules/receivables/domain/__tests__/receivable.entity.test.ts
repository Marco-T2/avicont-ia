import { describe, it, expect } from "vitest";
import { Receivable } from "../receivable.entity";
import { MonetaryAmount } from "../value-objects/monetary-amount";
import {
  InvalidReceivableStatusTransition,
  PartialPaymentAmountRequired,
  InvalidMonetaryAmount,
} from "../errors/receivable-errors";

const baseInput = {
  organizationId: "org-1",
  contactId: "contact-1",
  description: "Factura 0001",
  amount: 1000,
  dueDate: new Date("2026-05-15T00:00:00Z"),
};

describe("Receivable entity", () => {
  describe("create()", () => {
    it("returns a receivable with status PENDING and balance = amount", () => {
      const r = Receivable.create(baseInput);
      expect(r.status).toBe("PENDING");
      expect(r.amount.value).toBe(1000);
      expect(r.paid.value).toBe(0);
      expect(r.balance.value).toBe(1000);
    });

    it("assigns a UUID id", () => {
      const r = Receivable.create(baseInput);
      expect(r.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it("assigns createdAt and updatedAt to the same instant", () => {
      const r = Receivable.create(baseInput);
      expect(r.createdAt.getTime()).toBe(r.updatedAt.getTime());
    });

    it("preserves contact id, description and due date", () => {
      const r = Receivable.create(baseInput);
      expect(r.contactId).toBe("contact-1");
      expect(r.description).toBe("Factura 0001");
      expect(r.dueDate.getTime()).toBe(baseInput.dueDate.getTime());
    });

    it("optional fields default to null", () => {
      const r = Receivable.create(baseInput);
      expect(r.sourceType).toBeNull();
      expect(r.sourceId).toBeNull();
      expect(r.journalEntryId).toBeNull();
      expect(r.notes).toBeNull();
    });

    it("propagates optional fields when provided", () => {
      const r = Receivable.create({
        ...baseInput,
        sourceType: "dispatch",
        sourceId: "disp-1",
        journalEntryId: "je-1",
        notes: "x",
      });
      expect(r.sourceType).toBe("dispatch");
      expect(r.sourceId).toBe("disp-1");
      expect(r.journalEntryId).toBe("je-1");
      expect(r.notes).toBe("x");
    });

    it("rejects negative amount via MonetaryAmount", () => {
      expect(() => Receivable.create({ ...baseInput, amount: -1 })).toThrow(InvalidMonetaryAmount);
    });

    it("accepts string amount and normalizes to number", () => {
      const r = Receivable.create({ ...baseInput, amount: "1234.56" });
      expect(r.amount.value).toBe(1234.56);
    });
  });

  describe("fromPersistence()", () => {
    it("hydrates without re-validating amount > 0", () => {
      const r = Receivable.fromPersistence({
        id: "rec-1",
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
      expect(r.id).toBe("rec-1");
      expect(r.status).toBe("PARTIAL");
      expect(r.paid.value).toBe(200);
      expect(r.balance.value).toBe(300);
    });
  });

  describe("update()", () => {
    it("updates description without touching monetary fields", () => {
      const r = Receivable.create(baseInput);
      const updated = r.update({ description: "Factura editada" });
      expect(updated.description).toBe("Factura editada");
      expect(updated.amount.value).toBe(r.amount.value);
      expect(updated.paid.value).toBe(r.paid.value);
      expect(updated.balance.value).toBe(r.balance.value);
    });

    it("updates dueDate", () => {
      const r = Receivable.create(baseInput);
      const newDue = new Date("2026-12-31T00:00:00Z");
      const updated = r.update({ dueDate: newDue });
      expect(updated.dueDate.getTime()).toBe(newDue.getTime());
    });

    it("returns a new instance (immutable)", () => {
      const r = Receivable.create(baseInput);
      const updated = r.update({ description: "z" });
      expect(updated).not.toBe(r);
      expect(r.description).toBe("Factura 0001");
    });

    it("bumps updatedAt", async () => {
      const r = Receivable.create(baseInput);
      await new Promise((resolve) => setTimeout(resolve, 5));
      const updated = r.update({ description: "z" });
      expect(updated.updatedAt.getTime()).toBeGreaterThan(r.updatedAt.getTime());
    });

    it("allows clearing optional fields with null", () => {
      const r = Receivable.create({ ...baseInput, notes: "x" });
      const updated = r.update({ notes: null });
      expect(updated.notes).toBeNull();
    });
  });

  describe("transitionTo()", () => {
    it("PENDING → PAID sets paid=amount and balance=0", () => {
      const r = Receivable.create(baseInput);
      const paid = r.transitionTo("PAID");
      expect(paid.status).toBe("PAID");
      expect(paid.paid.value).toBe(1000);
      expect(paid.balance.value).toBe(0);
    });

    it("PENDING → PARTIAL with paidAmount sets balance = amount - paid", () => {
      const r = Receivable.create(baseInput);
      const partial = r.transitionTo("PARTIAL", 250);
      expect(partial.status).toBe("PARTIAL");
      expect(partial.paid.value).toBe(250);
      expect(partial.balance.value).toBe(750);
    });

    it("PENDING → PARTIAL without paidAmount throws PartialPaymentAmountRequired", () => {
      const r = Receivable.create(baseInput);
      expect(() => r.transitionTo("PARTIAL")).toThrow(PartialPaymentAmountRequired);
    });

    it("PENDING → VOIDED keeps paid and sets balance=0", () => {
      const r = Receivable.create(baseInput);
      const voided = r.transitionTo("VOIDED");
      expect(voided.status).toBe("VOIDED");
      expect(voided.paid.value).toBe(0);
      expect(voided.balance.value).toBe(0);
    });

    it("PARTIAL → VOIDED keeps prior paid and sets balance=0", () => {
      const r = Receivable.create(baseInput).transitionTo("PARTIAL", 400);
      const voided = r.transitionTo("VOIDED");
      expect(voided.status).toBe("VOIDED");
      expect(voided.paid.value).toBe(400);
      expect(voided.balance.value).toBe(0);
    });

    it("PARTIAL → PAID sets paid=amount and balance=0", () => {
      const r = Receivable.create(baseInput).transitionTo("PARTIAL", 400);
      const paid = r.transitionTo("PAID");
      expect(paid.paid.value).toBe(1000);
      expect(paid.balance.value).toBe(0);
    });

    it("PENDING → OVERDUE only changes status", () => {
      const r = Receivable.create(baseInput);
      const overdue = r.transitionTo("OVERDUE");
      expect(overdue.status).toBe("OVERDUE");
      expect(overdue.paid.value).toBe(r.paid.value);
      expect(overdue.balance.value).toBe(r.balance.value);
    });

    it("PAID is terminal — any transition throws", () => {
      const r = Receivable.create(baseInput).transitionTo("PAID");
      expect(() => r.transitionTo("PENDING")).toThrow(InvalidReceivableStatusTransition);
      expect(() => r.transitionTo("PARTIAL", 100)).toThrow(InvalidReceivableStatusTransition);
      expect(() => r.transitionTo("VOIDED")).toThrow(InvalidReceivableStatusTransition);
    });

    it("VOIDED is terminal — any transition throws", () => {
      const r = Receivable.create(baseInput).transitionTo("VOIDED");
      expect(() => r.transitionTo("PENDING")).toThrow(InvalidReceivableStatusTransition);
      expect(() => r.transitionTo("PAID")).toThrow(InvalidReceivableStatusTransition);
    });

    it("returns a new instance with bumped updatedAt", async () => {
      const r = Receivable.create(baseInput);
      await new Promise((resolve) => setTimeout(resolve, 5));
      const next = r.transitionTo("PAID");
      expect(next).not.toBe(r);
      expect(next.updatedAt.getTime()).toBeGreaterThan(r.updatedAt.getTime());
    });
  });

  describe("void()", () => {
    it("is a shortcut for transitionTo('VOIDED')", () => {
      const r = Receivable.create(baseInput);
      const voided = r.void();
      expect(voided.status).toBe("VOIDED");
      expect(voided.balance.value).toBe(0);
    });

    it("respects terminal-state guards", () => {
      const r = Receivable.create(baseInput).transitionTo("PAID");
      expect(() => r.void()).toThrow(InvalidReceivableStatusTransition);
    });
  });

  describe("toSnapshot()", () => {
    it("returns a POJO with monetary fields as numbers", () => {
      const r = Receivable.create(baseInput).transitionTo("PARTIAL", 250.5);
      const snap = r.toSnapshot();
      expect(typeof snap.amount).toBe("number");
      expect(typeof snap.paid).toBe("number");
      expect(typeof snap.balance).toBe("number");
      expect(snap.amount).toBe(1000);
      expect(snap.paid).toBe(250.5);
      expect(snap.balance).toBe(749.5);
    });

    it("preserves ids, status, dates and optional fields", () => {
      const r = Receivable.create({ ...baseInput, sourceType: "dispatch", sourceId: "d-1" });
      const snap = r.toSnapshot();
      expect(snap.id).toBe(r.id);
      expect(snap.organizationId).toBe("org-1");
      expect(snap.contactId).toBe("contact-1");
      expect(snap.status).toBe("PENDING");
      expect(snap.sourceType).toBe("dispatch");
      expect(snap.sourceId).toBe("d-1");
      expect(snap.journalEntryId).toBeNull();
      expect(snap.notes).toBeNull();
      expect(snap.createdAt).toBeInstanceOf(Date);
      expect(snap.updatedAt).toBeInstanceOf(Date);
      expect(snap.dueDate.getTime()).toBe(baseInput.dueDate.getTime());
    });
  });
});
