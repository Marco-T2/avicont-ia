import "server-only";
import { ExpenseService } from "../application/expense.service";
import { PrismaExpensesRepository } from "../infrastructure/prisma-expenses.repository";
import { LocalExpensesInquiryAdapter } from "../infrastructure/local-expenses-inquiry.adapter";

export { PrismaExpensesRepository };
export { LocalExpensesInquiryAdapter };

export function makeExpenseService(): ExpenseService {
  return new ExpenseService(new PrismaExpensesRepository());
}

export function makeExpensesRepository(): PrismaExpensesRepository {
  return new PrismaExpensesRepository();
}
