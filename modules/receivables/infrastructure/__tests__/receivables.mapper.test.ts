import { describe, it, expect } from "vitest";
import { Prisma, type AccountsReceivable } from "@/generated/prisma/client";
import { toDomain, toPersistence } from "../receivables.mapper";
import { Receivable } from "../../domain/receivable.entity";

const row = (override: Partial<AccountsReceivable> = {}): AccountsReceivable => ({
  id: "rec-1",
  organizationId: "org-1",
  contactId: "contact-1",
  description: "Factura",
  amount: new Prisma.Decimal(1000),
  paid: new Prisma.Decimal(250),
  balance: new Prisma.Decimal(750),
  dueDate: new Date("2026-05-15T00:00:00Z"),
  status: "PARTIAL",
  sourceType: "dispatch",
  sourceId: "disp-1",
  journalEntryId: "je-1",
  notes: null,
  createdAt: new Date("2026-04-01T00:00:00Z"),
  updatedAt: new Date("2026-04-15T00:00:00Z"),
  ...override,
});

describe("receivables mapper", () => {
  describe("toDomain()", () => {
    it("hydrates a Receivable from a Prisma row", () => {
      const r = toDomain(row());
      expect(r.id).toBe("rec-1");
      expect(r.organizationId).toBe("org-1");
      expect(r.contactId).toBe("contact-1");
      expect(r.description).toBe("Factura");
      expect(r.amount.value).toBe(1000);
      expect(r.paid.value).toBe(250);
      expect(r.balance.value).toBe(750);
      expect(r.status).toBe("PARTIAL");
      expect(r.sourceType).toBe("dispatch");
      expect(r.sourceId).toBe("disp-1");
      expect(r.journalEntryId).toBe("je-1");
      expect(r.notes).toBeNull();
    });

    it("converts Decimal monetary fields to plain numbers", () => {
      const r = toDomain(row({
        amount: new Prisma.Decimal("1234.56"),
        paid: new Prisma.Decimal("100.50"),
        balance: new Prisma.Decimal("1134.06"),
      }));
      expect(r.amount.value).toBe(1234.56);
      expect(r.paid.value).toBe(100.5);
      expect(r.balance.value).toBe(1134.06);
    });

    it("preserves PENDING status", () => {
      const r = toDomain(row({ status: "PENDING", paid: new Prisma.Decimal(0), balance: new Prisma.Decimal(1000) }));
      expect(r.status).toBe("PENDING");
    });
  });

  describe("toPersistence()", () => {
    it("returns a Prisma-compatible payload with Decimal monetary fields", () => {
      const entity = Receivable.create({
        organizationId: "org-1",
        contactId: "contact-1",
        description: "Factura",
        amount: 1000,
        dueDate: new Date("2026-05-15"),
      });
      const data = toPersistence(entity);
      expect(data.id).toBe(entity.id);
      expect(data.organizationId).toBe("org-1");
      expect(data.contactId).toBe("contact-1");
      expect(data.amount).toBeInstanceOf(Prisma.Decimal);
      expect(data.amount.toString()).toBe("1000");
      expect(data.paid.toString()).toBe("0");
      expect(data.balance.toString()).toBe("1000");
      expect(data.status).toBe("PENDING");
      expect(data.notes).toBeNull();
    });

    it("preserves status after a transition", () => {
      const entity = Receivable.create({
        organizationId: "org-1",
        contactId: "contact-1",
        description: "x",
        amount: 500,
        dueDate: new Date("2026-05-15"),
      }).transitionTo("PARTIAL", 200);
      const data = toPersistence(entity);
      expect(data.status).toBe("PARTIAL");
      expect(data.paid.toString()).toBe("200");
      expect(data.balance.toString()).toBe("300");
    });
  });

  describe("roundtrip", () => {
    it("toPersistence(toDomain(row)) yields a Decimal-equivalent payload", () => {
      const original = row();
      const entity = toDomain(original);
      const data = toPersistence(entity);
      expect(data.id).toBe(original.id);
      expect(data.amount.toString()).toBe(original.amount.toString());
      expect(data.paid.toString()).toBe(original.paid.toString());
      expect(data.balance.toString()).toBe(original.balance.toString());
      expect(data.status).toBe(original.status);
      expect(data.dueDate.getTime()).toBe(original.dueDate.getTime());
    });
  });
});
