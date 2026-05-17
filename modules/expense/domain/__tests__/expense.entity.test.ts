import { describe, it, expect } from "vitest";
import { Expense } from "../expense.entity";
import type { ExpenseCategory } from "../value-objects/expense-category";

const baseCreate = (
  override: Partial<{
    amount: number;
    category: ExpenseCategory;
    description: string;
    date: Date;
    lotId: string;
    organizationId: string;
    createdById: string;
  }> = {},
) => ({
  amount: override.amount ?? 100,
  category: override.category ?? ("ALIMENTO" as ExpenseCategory),
  description: override.description,
  date: override.date ?? new Date("2026-01-15"),
  lotId: override.lotId ?? "lot-1",
  organizationId: override.organizationId ?? "org-1",
  createdById: override.createdById ?? "user-1",
});

describe("Expense.update", () => {
  it("returns a new instance with updated amount (immutable)", () => {
    const e = Expense.create(baseCreate({ amount: 100 }));

    const updated = e.update({ amount: 250 });

    expect(updated).not.toBe(e);
    expect(updated.amount).toBe(250);
    expect(e.amount).toBe(100); // original unchanged
  });

  it("preserves id, lotId, organizationId, createdById, createdAt (INV-03)", () => {
    const e = Expense.create(baseCreate());

    const updated = e.update({ amount: 500 });

    expect(updated.id).toBe(e.id);
    expect(updated.lotId).toBe(e.lotId);
    expect(updated.organizationId).toBe(e.organizationId);
    expect(updated.createdById).toBe(e.createdById);
    expect(updated.createdAt).toEqual(e.createdAt);
  });

  it("updates updatedAt to the current time when changing fields", async () => {
    const e = Expense.create(baseCreate());
    const before = e.updatedAt;
    // Force a measurable gap so the comparison is unambiguous.
    await new Promise((r) => setTimeout(r, 5));

    const updated = e.update({ amount: 999 });

    expect(updated.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  it("updates category, date, and description when provided", () => {
    const e = Expense.create(baseCreate({ category: "ALIMENTO" as ExpenseCategory }));
    const newDate = new Date("2026-02-20");

    const updated = e.update({
      category: "AGUA" as ExpenseCategory,
      date: newDate,
      description: "corrección",
    });

    expect(updated.category).toBe("AGUA");
    expect(updated.date).toEqual(newDate);
    expect(updated.description).toBe("corrección");
  });

  it("keeps prior values when fields are omitted (partial update)", () => {
    const e = Expense.create(
      baseCreate({ amount: 100, description: "original" }),
    );

    const updated = e.update({ amount: 200 });

    expect(updated.amount).toBe(200);
    expect(updated.description).toBe("original"); // keep prior
    expect(updated.category).toBe(e.category);
    expect(updated.date).toEqual(e.date);
  });

  it("treats description: null as a clear (different from undefined)", () => {
    const e = Expense.create(baseCreate({ description: "to-clear" }));

    const updated = e.update({ description: null });

    expect(updated.description).toBeNull();
  });
});
