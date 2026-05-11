import "server-only";
import { prisma } from "@/lib/prisma";
import { type PrismaClient } from "@/generated/prisma/client";
import type {
  ExpensesRepository,
  ExpenseTotalByCategory,
} from "../domain/expense.repository";
import { Expense } from "../domain/expense.entity";
import type { ExpenseCategory } from "../domain/value-objects/expense-category";
import { toDomain, toPersistence } from "./expense.mapper";

type DbClient = Pick<PrismaClient, "expense">;

export class PrismaExpensesRepository implements ExpensesRepository {
  constructor(private readonly db: DbClient = prisma) {}

  async findAll(organizationId: string): Promise<Expense[]> {
    const rows = await this.db.expense.findMany({
      where: { organizationId },
      orderBy: { date: "desc" },
    });
    return rows.map(toDomain);
  }

  async findById(organizationId: string, id: string): Promise<Expense | null> {
    const row = await this.db.expense.findFirst({
      where: { id, organizationId },
    });
    return row ? toDomain(row) : null;
  }

  async findByLot(
    organizationId: string,
    lotId: string,
  ): Promise<Expense[]> {
    const rows = await this.db.expense.findMany({
      where: { organizationId, lotId },
      orderBy: { date: "desc" },
    });
    return rows.map(toDomain);
  }

  async save(entity: Expense): Promise<void> {
    await this.db.expense.create({ data: toPersistence(entity) });
  }

  async delete(organizationId: string, id: string): Promise<void> {
    await this.db.expense.delete({
      where: { id, organizationId },
    });
  }

  async sumByLot(organizationId: string, lotId: string): Promise<number> {
    const result = await this.db.expense.aggregate({
      where: { organizationId, lotId },
      _sum: { amount: true },
    });
    return result._sum.amount ? Number(result._sum.amount) : 0;
  }

  async totalsByCategory(
    organizationId: string,
    lotId: string,
  ): Promise<ExpenseTotalByCategory[]> {
    const results = await this.db.expense.groupBy({
      by: ["category"],
      where: { organizationId, lotId },
      _sum: { amount: true },
      orderBy: { category: "asc" },
    });
    return results.map((r) => ({
      category: r.category as ExpenseCategory,
      total: r._sum.amount ? Number(r._sum.amount) : 0,
    }));
  }
}
