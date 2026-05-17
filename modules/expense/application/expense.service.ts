import {
  Expense,
  type CreateExpenseInput,
  type UpdateExpenseInput,
} from "../domain/expense.entity";
import type {
  ExpensesRepository,
  ExpenseTotalByCategory,
} from "../domain/expense.repository";
import { ExpenseNotFoundError } from "../domain/errors/expense-errors";

export type CreateExpenseServiceInput = Omit<CreateExpenseInput, "organizationId">;
export type UpdateExpenseServiceInput = UpdateExpenseInput;

export class ExpenseService {
  constructor(private readonly repo: ExpensesRepository) {}

  async list(organizationId: string): Promise<Expense[]> {
    return this.repo.findAll(organizationId);
  }

  async listByLot(organizationId: string, lotId: string): Promise<Expense[]> {
    return this.repo.findByLot(organizationId, lotId);
  }

  async getById(organizationId: string, id: string): Promise<Expense> {
    const found = await this.repo.findById(organizationId, id);
    if (!found) throw new ExpenseNotFoundError(id);
    return found;
  }

  async create(
    organizationId: string,
    input: CreateExpenseServiceInput,
  ): Promise<Expense> {
    const expense = Expense.create({ ...input, organizationId });
    await this.repo.save(expense);
    return expense;
  }

  /**
   * Updates editable fields (amount/category/date/description) of an
   * Expense. lotId, organizationId, createdById, createdAt are
   * preserved (INV-03). updatedAt advances on every call. Spec REQ-103.
   * Throws ExpenseNotFoundError when id does not exist.
   */
  async update(
    organizationId: string,
    id: string,
    input: UpdateExpenseServiceInput,
  ): Promise<Expense> {
    const existing = await this.getById(organizationId, id);
    const updated = existing.update(input);
    await this.repo.update(updated);
    return updated;
  }

  async delete(organizationId: string, id: string): Promise<void> {
    await this.getById(organizationId, id);
    await this.repo.delete(organizationId, id);
  }

  async getTotalByLot(organizationId: string, lotId: string): Promise<number> {
    return this.repo.sumByLot(organizationId, lotId);
  }

  async getTotalsByCategory(
    organizationId: string,
    lotId: string,
  ): Promise<ExpenseTotalByCategory[]> {
    return this.repo.totalsByCategory(organizationId, lotId);
  }
}
