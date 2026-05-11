import type { Expense } from "./expense.entity";
import type { ExpenseCategory } from "./value-objects/expense-category";

export interface ExpenseTotalByCategory {
  category: ExpenseCategory;
  total: number;
}

export interface ExpensesRepository {
  findAll(organizationId: string): Promise<Expense[]>;
  findById(organizationId: string, id: string): Promise<Expense | null>;
  findByLot(organizationId: string, lotId: string): Promise<Expense[]>;
  save(expense: Expense): Promise<void>;
  delete(organizationId: string, id: string): Promise<void>;
  sumByLot(organizationId: string, lotId: string): Promise<number>;
  totalsByCategory(
    organizationId: string,
    lotId: string,
  ): Promise<ExpenseTotalByCategory[]>;
}
