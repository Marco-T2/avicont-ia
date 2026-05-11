import "server-only";

export {
  makeExpenseService,
  makeExpensesRepository,
  PrismaExpensesRepository,
  LocalExpensesInquiryAdapter,
} from "./composition-root";

export { createExpenseSchema, expenseIdSchema } from "./validation";

export { Expense } from "../domain/expense.entity";
export type {
  ExpenseProps,
  CreateExpenseInput,
} from "../domain/expense.entity";
export type {
  ExpensesRepository,
  ExpenseTotalByCategory,
} from "../domain/expense.repository";
export type { ExpenseCategory } from "../domain/value-objects/expense-category";
export { EXPENSE_CATEGORIES } from "../domain/value-objects/expense-category";
export {
  ExpenseService,
  type CreateExpenseServiceInput,
} from "../application/expense.service";
export type {
  ExpensesInquiryPort,
  ExpenseSnapshot,
} from "../domain/ports/expense-inquiry.port";
export {
  ExpenseNotFoundError,
  ExpenseValidationError,
} from "../domain/errors/expense-errors";
