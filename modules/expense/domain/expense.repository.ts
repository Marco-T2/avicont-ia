import type { Expense } from "./expense.entity";

export interface ExpensesRepository {
  findAll(organizationId: string): Promise<Expense[]>;
  findById(organizationId: string, id: string): Promise<Expense | null>;
  findByLot(organizationId: string, lotId: string): Promise<Expense[]>;
  save(expense: Expense): Promise<void>;
  delete(organizationId: string, id: string): Promise<void>;
}
