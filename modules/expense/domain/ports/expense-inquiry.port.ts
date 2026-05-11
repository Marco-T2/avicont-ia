import type { ExpenseCategory } from "../value-objects/expense-category";

export type ExpenseSnapshot = {
  id: string;
  amount: number;
  category: ExpenseCategory;
  description: string | null;
  date: Date;
  lotId: string;
  organizationId: string;
  createdById: string;
  createdAt: Date;
};

export interface ExpensesInquiryPort {
  list(
    organizationId: string,
    filters?: { lotId?: string },
  ): Promise<ExpenseSnapshot[]>;
  findById(
    organizationId: string,
    id: string,
  ): Promise<ExpenseSnapshot | null>;
}
