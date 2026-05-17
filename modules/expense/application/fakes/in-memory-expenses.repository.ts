import type { Expense } from "../../domain/expense.entity";
import type {
  ExpensesRepository,
  ExpenseTotalByCategory,
} from "../../domain/expense.repository";
import type { ExpenseCategory } from "../../domain/value-objects/expense-category";

/**
 * Minimal in-memory implementation of ExpensesRepository for service tests.
 * Mirrors `modules/documents/application/fakes/` pattern.
 * `update` is not exposed yet — port adds it in Fase 5 (T19).
 */
export class InMemoryExpensesRepository implements ExpensesRepository {
  private readonly store = new Map<string, Expense>();

  reset(): void {
    this.store.clear();
  }

  async findAll(organizationId: string): Promise<Expense[]> {
    return [...this.store.values()].filter(
      (e) => e.organizationId === organizationId,
    );
  }

  async findById(
    organizationId: string,
    id: string,
  ): Promise<Expense | null> {
    const e = this.store.get(id);
    return e && e.organizationId === organizationId ? e : null;
  }

  async findByLot(
    organizationId: string,
    lotId: string,
  ): Promise<Expense[]> {
    return [...this.store.values()].filter(
      (e) => e.organizationId === organizationId && e.lotId === lotId,
    );
  }

  async save(expense: Expense): Promise<void> {
    this.store.set(expense.id, expense);
  }

  async update(expense: Expense): Promise<void> {
    this.store.set(expense.id, expense);
  }

  async delete(organizationId: string, id: string): Promise<void> {
    const e = this.store.get(id);
    if (e && e.organizationId === organizationId) {
      this.store.delete(id);
    }
  }

  async sumByLot(
    organizationId: string,
    lotId: string,
  ): Promise<number> {
    return [...this.store.values()]
      .filter(
        (e) => e.organizationId === organizationId && e.lotId === lotId,
      )
      .reduce((sum, e) => sum + e.amount, 0);
  }

  async totalsByCategory(
    organizationId: string,
    lotId: string,
  ): Promise<ExpenseTotalByCategory[]> {
    const map = new Map<ExpenseCategory, number>();
    for (const e of this.store.values()) {
      if (e.organizationId !== organizationId || e.lotId !== lotId) continue;
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    }
    return [...map.entries()].map(([category, total]) => ({
      category,
      total,
    }));
  }
}
