import { describe, it, expect } from "vitest";
import {
  type Expense as PrismaExpense,
  Prisma,
} from "@/generated/prisma/client";
import { toDomain, toPersistence } from "../expense.mapper";
import { Expense } from "../../domain/expense.entity";

const row = (override: Partial<PrismaExpense> = {}): PrismaExpense => ({
  id: "exp-1",
  organizationId: "org-1",
  amount: new Prisma.Decimal("100.50"),
  category: "ALIMENTO",
  description: null,
  date: new Date("2026-01-15"),
  lotId: "lot-1",
  createdById: "u-1",
  createdAt: new Date("2026-01-15"),
  ...override,
});

describe("expense mapper", () => {
  describe("toDomain()", () => {
    // α22
    it("hydrates an Expense from a Prisma Expense row", () => {
      const e = toDomain(row());
      expect(e).toBeInstanceOf(Expense);
      expect(e.id).toBe("exp-1");
      expect(e.lotId).toBe("lot-1");
      expect(e.organizationId).toBe("org-1");
    });

    // α23
    it("preserves category enum (Prisma ExpenseCategory → domain ExpenseCategory)", () => {
      const alimento = toDomain(row({ category: "ALIMENTO" }));
      const agua = toDomain(row({ category: "AGUA" }));
      const otros = toDomain(row({ category: "OTROS" }));
      expect(alimento.category).toBe("ALIMENTO");
      expect(agua.category).toBe("AGUA");
      expect(otros.category).toBe("OTROS");
    });

    // α24
    it("preserves description null vs string", () => {
      const withNull = toDomain(row({ description: null }));
      const withText = toDomain(row({ description: "compra X" }));
      expect(withNull.description).toBeNull();
      expect(withText.description).toBe("compra X");
    });

    // α25 — D1 Opt B lossy boundary Prisma.Decimal → number
    it("converts Prisma.Decimal amount → number at boundary (D1 Opt B lossy)", () => {
      const e = toDomain(row({ amount: new Prisma.Decimal("1234.56") }));
      expect(typeof e.amount).toBe("number");
      expect(e.amount).toBe(1234.56);
    });
  });

  describe("toPersistence()", () => {
    const buildEntity = () =>
      Expense.create({
        organizationId: "org-1",
        amount: 100,
        category: "ALIMENTO",
        date: new Date("2026-01-15"),
        lotId: "lot-1",
        createdById: "u-1",
      });

    // α26
    it("returns a Prisma Expense create payload", () => {
      const entity = buildEntity();
      const data = toPersistence(entity);
      expect(data.id).toBe(entity.id);
      expect(data.lotId).toBe("lot-1");
      expect(data.organizationId).toBe("org-1");
      expect(data.category).toBe("ALIMENTO");
    });

    // α27
    it("preserves createdAt + date timestamps", () => {
      const entity = buildEntity();
      const data = toPersistence(entity);
      expect(data.createdAt).toBeInstanceOf(Date);
      expect(data.date).toBeInstanceOf(Date);
    });

    // α28
    it("preserves description null when not provided", () => {
      const entity = buildEntity();
      const data = toPersistence(entity);
      expect(data.description).toBeNull();
    });
  });

  describe("roundtrip", () => {
    // α29
    it("toPersistence(toDomain(row)) yields equivalent payload", () => {
      const original = row();
      const entity = toDomain(original);
      const data = toPersistence(entity);
      expect(data.id).toBe(original.id);
      expect(data.lotId).toBe(original.lotId);
      expect(data.organizationId).toBe(original.organizationId);
      expect(data.category).toBe(original.category);
      expect(data.date.getTime()).toBe(original.date.getTime());
    });
  });
});
