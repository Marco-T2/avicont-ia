import { describe, it, expect, vi } from "vitest";
import {
  type PrismaClient,
  Prisma,
} from "@/generated/prisma/client";
import { PrismaExpensesRepository } from "../prisma-expenses.repository";
import { Expense } from "../../domain/expense.entity";

const dbWith = (overrides: Record<string, unknown>): PrismaClient =>
  ({ expense: overrides }) as unknown as PrismaClient;

const buildEntity = () =>
  Expense.create({
    organizationId: "org-1",
    amount: 100,
    category: "ALIMENTO",
    date: new Date("2026-01-15"),
    lotId: "lot-1",
    createdById: "u-1",
  });

const buildRow = (override: Record<string, unknown> = {}) => ({
  id: "exp-1",
  organizationId: "org-1",
  amount: new Prisma.Decimal("100.50"),
  category: "ALIMENTO" as const,
  description: null,
  date: new Date("2026-01-15"),
  lotId: "lot-1",
  createdById: "u-1",
  createdAt: new Date("2026-01-15"),
  ...override,
});

describe("PrismaExpensesRepository", () => {
  describe("findAll", () => {
    // α30
    it("scopes by organizationId and orders by date desc", async () => {
      const findMany = vi.fn().mockResolvedValueOnce([buildRow()]);
      const repo = new PrismaExpensesRepository(dbWith({ findMany }));

      const result = await repo.findAll("org-1");

      expect(findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1" },
        orderBy: { date: "desc" },
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.organizationId).toBe("org-1");
    });
  });

  describe("findById", () => {
    // α31
    it("returns null when no row found", async () => {
      const findFirst = vi.fn().mockResolvedValueOnce(null);
      const repo = new PrismaExpensesRepository(dbWith({ findFirst }));

      const result = await repo.findById("org-1", "exp-1");

      expect(findFirst).toHaveBeenCalledWith({
        where: { id: "exp-1", organizationId: "org-1" },
      });
      expect(result).toBeNull();
    });

    // α32
    it("returns an Expense domain entity via toDomain when found", async () => {
      const findFirst = vi.fn().mockResolvedValueOnce(buildRow());
      const repo = new PrismaExpensesRepository(dbWith({ findFirst }));

      const result = await repo.findById("org-1", "exp-1");

      expect(result?.id).toBe("exp-1");
      expect(result?.lotId).toBe("lot-1");
    });
  });

  describe("findByLot", () => {
    // α33
    it("scopes by lotId+organizationId and orders by date desc", async () => {
      const findMany = vi.fn().mockResolvedValueOnce([buildRow()]);
      const repo = new PrismaExpensesRepository(dbWith({ findMany }));

      await repo.findByLot("org-1", "lot-1");

      expect(findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1", lotId: "lot-1" },
        orderBy: { date: "desc" },
      });
    });
  });

  describe("save", () => {
    // α34
    it("creates with the persistence payload of the entity", async () => {
      const create = vi.fn().mockResolvedValueOnce(undefined);
      const repo = new PrismaExpensesRepository(dbWith({ create }));

      const entity = buildEntity();
      await repo.save(entity);

      expect(create).toHaveBeenCalledTimes(1);
      const callArg = create.mock.calls[0]?.[0];
      expect(callArg.data.id).toBe(entity.id);
      expect(callArg.data.lotId).toBe("lot-1");
      expect(callArg.data.category).toBe("ALIMENTO");
    });
  });

  describe("delete", () => {
    // α35
    it("scopes delete by id+organizationId", async () => {
      const deleteFn = vi.fn().mockResolvedValueOnce(undefined);
      const repo = new PrismaExpensesRepository(dbWith({ delete: deleteFn }));

      await repo.delete("org-1", "exp-1");

      expect(deleteFn).toHaveBeenCalledWith({
        where: { id: "exp-1", organizationId: "org-1" },
      });
    });
  });

  describe("sumByLot", () => {
    // α36
    it("returns sum of amounts via aggregate _sum.amount.toNumber()", async () => {
      const aggregate = vi.fn().mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("500") },
      });
      const repo = new PrismaExpensesRepository(dbWith({ aggregate }));

      const total = await repo.sumByLot("org-1", "lot-1");

      expect(aggregate).toHaveBeenCalledWith({
        where: { organizationId: "org-1", lotId: "lot-1" },
        _sum: { amount: true },
      });
      expect(total).toBe(500);
    });
  });

  describe("totalsByCategory", () => {
    // α37
    it("returns array of { category, total } via groupBy category", async () => {
      const groupBy = vi.fn().mockResolvedValueOnce([
        { category: "ALIMENTO", _sum: { amount: new Prisma.Decimal("300") } },
        { category: "AGUA", _sum: { amount: new Prisma.Decimal("200") } },
      ]);
      const repo = new PrismaExpensesRepository(dbWith({ groupBy }));

      const totals = await repo.totalsByCategory("org-1", "lot-1");

      expect(groupBy).toHaveBeenCalledWith({
        by: ["category"],
        where: { organizationId: "org-1", lotId: "lot-1" },
        _sum: { amount: true },
        orderBy: { category: "asc" },
      });
      expect(totals).toEqual([
        { category: "ALIMENTO", total: 300 },
        { category: "AGUA", total: 200 },
      ]);
    });
  });
});
