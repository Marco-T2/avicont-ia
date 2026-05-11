import { describe, it, expect, beforeEach } from "vitest";
import { ExpenseService } from "../expense.service";
import { Expense } from "../../domain/expense.entity";
import type { ExpensesRepository } from "../../domain/expense.repository";
import { ExpenseNotFoundError } from "../../domain/errors/expense-errors";
import type { ExpenseCategory } from "../../domain/value-objects/expense-category";

class InMemoryExpensesRepository implements ExpensesRepository {
  private readonly store = new Map<string, Expense>();

  reset() {
    this.store.clear();
  }

  async findAll(orgId: string): Promise<Expense[]> {
    return [...this.store.values()].filter(
      (e) => e.organizationId === orgId,
    );
  }

  async findById(orgId: string, id: string): Promise<Expense | null> {
    const e = this.store.get(id);
    return e && e.organizationId === orgId ? e : null;
  }

  async findByLot(orgId: string, lotId: string): Promise<Expense[]> {
    return [...this.store.values()].filter(
      (e) => e.organizationId === orgId && e.lotId === lotId,
    );
  }

  async save(expense: Expense): Promise<void> {
    this.store.set(expense.id, expense);
  }

  async delete(orgId: string, id: string): Promise<void> {
    const e = this.store.get(id);
    if (e && e.organizationId === orgId) {
      this.store.delete(id);
    }
  }
}

const ORG = "org-1";
const LOT = "lot-1";
const USER = "user-1";

const baseInput = (
  override: Partial<{
    amount: number;
    category: ExpenseCategory;
    description: string;
    date: Date;
    lotId: string;
    createdById: string;
  }> = {},
) => ({
  amount: override.amount ?? 100,
  category: override.category ?? ("ALIMENTO" as ExpenseCategory),
  description: override.description,
  date: override.date ?? new Date("2026-01-15"),
  lotId: override.lotId ?? LOT,
  createdById: override.createdById ?? USER,
});

describe("ExpenseService", () => {
  let repo: InMemoryExpensesRepository;
  let svc: ExpenseService;

  beforeEach(() => {
    repo = new InMemoryExpensesRepository();
    svc = new ExpenseService(repo);
  });

  describe("list", () => {
    // α8
    it("returns expenses scoped to org", async () => {
      const e = await svc.create(ORG, baseInput());
      const items = await svc.list(ORG);
      expect(items).toHaveLength(1);
      expect(items[0]?.id).toBe(e.id);
    });

    // α9
    it("returns empty when no expenses in org", async () => {
      const items = await svc.list(ORG);
      expect(items).toEqual([]);
    });
  });

  describe("listByLot", () => {
    // α10
    it("returns expenses scoped to lot within org", async () => {
      const e = await svc.create(ORG, baseInput({ lotId: LOT }));
      await svc.create(ORG, baseInput({ lotId: "lot-2" }));
      const items = await svc.listByLot(ORG, LOT);
      expect(items).toHaveLength(1);
      expect(items[0]?.id).toBe(e.id);
    });

    // α11
    it("returns empty when no expenses for lot", async () => {
      const items = await svc.listByLot(ORG, LOT);
      expect(items).toEqual([]);
    });
  });

  describe("getById", () => {
    // α12
    it("returns expense by id within org", async () => {
      const e = await svc.create(ORG, baseInput());
      const found = await svc.getById(ORG, e.id);
      expect(found.id).toBe(e.id);
    });

    // α13
    it("throws ExpenseNotFoundError when expense missing", async () => {
      await expect(svc.getById(ORG, "missing")).rejects.toThrow(
        ExpenseNotFoundError,
      );
    });
  });

  describe("create", () => {
    // α14
    it("persists and returns the created Expense", async () => {
      const e = await svc.create(ORG, baseInput({ amount: 250 }));
      expect(e.organizationId).toBe(ORG);
      expect(e.amount).toBe(250);
      const found = await svc.getById(ORG, e.id);
      expect(found.id).toBe(e.id);
    });

    // α15
    it("generates id + createdAt for new expense", async () => {
      const e = await svc.create(ORG, baseInput());
      expect(typeof e.id).toBe("string");
      expect(e.id.length).toBeGreaterThan(0);
      expect(e.createdAt).toBeInstanceOf(Date);
    });
  });

  describe("delete", () => {
    // α16
    it("removes existing expense from repo", async () => {
      const e = await svc.create(ORG, baseInput());
      await svc.delete(ORG, e.id);
      await expect(svc.getById(ORG, e.id)).rejects.toThrow(
        ExpenseNotFoundError,
      );
    });

    // α17
    it("throws ExpenseNotFoundError when expense missing", async () => {
      await expect(svc.delete(ORG, "missing")).rejects.toThrow(
        ExpenseNotFoundError,
      );
    });
  });
});
