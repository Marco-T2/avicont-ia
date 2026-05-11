import {
  type Expense as PrismaExpense,
  Prisma,
} from "@/generated/prisma/client";
import { Expense } from "../domain/expense.entity";
import type { ExpenseCategory } from "../domain/value-objects/expense-category";

export function toDomain(row: PrismaExpense): Expense {
  return Expense.fromPersistence({
    id: row.id,
    amount: Number(row.amount),
    category: row.category as ExpenseCategory,
    description: row.description,
    date: row.date,
    lotId: row.lotId,
    organizationId: row.organizationId,
    createdById: row.createdById,
    createdAt: row.createdAt,
  });
}

export function toPersistence(entity: Expense) {
  const s = entity.toSnapshot();
  return {
    id: s.id,
    amount: new Prisma.Decimal(s.amount),
    category: s.category,
    description: s.description,
    date: s.date,
    lotId: s.lotId,
    organizationId: s.organizationId,
    createdById: s.createdById,
    createdAt: s.createdAt,
  };
}
