import "server-only";
import { ExpenseService } from "../application/expense.service";
import { PrismaExpensesRepository } from "./prisma-expenses.repository";
import { ExpenseNotFoundError } from "../domain/errors/expense-errors";
import type {
  ExpensesInquiryPort,
  ExpenseSnapshot,
} from "../domain/ports/expense-inquiry.port";

export class LocalExpensesInquiryAdapter implements ExpensesInquiryPort {
  constructor(
    private readonly expenses: ExpenseService = new ExpenseService(
      new PrismaExpensesRepository(),
    ),
  ) {}

  async list(
    organizationId: string,
    filters?: { lotId?: string },
  ): Promise<ExpenseSnapshot[]> {
    const items = filters?.lotId
      ? await this.expenses.listByLot(organizationId, filters.lotId)
      : await this.expenses.list(organizationId);
    return items.map((e) => e.toSnapshot());
  }

  async findById(
    organizationId: string,
    id: string,
  ): Promise<ExpenseSnapshot | null> {
    try {
      const expense = await this.expenses.getById(organizationId, id);
      return expense.toSnapshot();
    } catch (err) {
      if (err instanceof ExpenseNotFoundError) return null;
      throw err;
    }
  }
}
