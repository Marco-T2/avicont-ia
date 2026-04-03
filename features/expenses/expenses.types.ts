import type { Expense, ExpenseCategory } from "@/generated/prisma/client";

// ── Domain types ──

export type ExpenseWithRelations = Expense & {
  lot: { name: string; barnNumber: number };
  createdBy: { name: string | null; email: string };
};

export interface CreateExpenseInput {
  amount: number;
  category: ExpenseCategory;
  description?: string;
  date: Date;
  lotId: string;
  createdById: string;
}

export interface UpdateExpenseInput {
  amount?: number;
  category?: ExpenseCategory;
  description?: string;
  date?: Date;
}

export interface ExpenseFilters {
  lotId?: string;
  category?: ExpenseCategory;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface ExpenseTotalByCategory {
  category: ExpenseCategory;
  total: number;
}
