import "server-only";
import { BaseRepository } from "@/features/shared/base.repository";
import { Prisma } from "@/generated/prisma/client";
import type {
  CreateExpenseInput,
  UpdateExpenseInput,
  ExpenseFilters,
  ExpenseWithRelations,
  ExpenseTotalByCategory,
} from "./expenses.types";

const expenseInclude = {
  lot: { select: { name: true, barnNumber: true } },
  createdBy: { select: { name: true, email: true } },
} as const;

export class ExpensesRepository extends BaseRepository {
  async findAll(
    organizationId: string,
    filters?: ExpenseFilters,
  ): Promise<ExpenseWithRelations[]> {
    const scope = this.requireOrg(organizationId);

    const where: Prisma.ExpenseWhereInput = {
      ...scope,
      ...(filters?.lotId && { lotId: filters.lotId }),
      ...(filters?.category && { category: filters.category }),
      ...((filters?.dateFrom || filters?.dateTo) && {
        date: {
          ...(filters.dateFrom && { gte: filters.dateFrom }),
          ...(filters.dateTo && { lte: filters.dateTo }),
        },
      }),
    };

    return this.db.expense.findMany({
      where,
      include: expenseInclude,
      orderBy: { date: "desc" },
    }) as Promise<ExpenseWithRelations[]>;
  }

  async findById(
    organizationId: string,
    id: string,
  ): Promise<ExpenseWithRelations | null> {
    const scope = this.requireOrg(organizationId);

    return this.db.expense.findFirst({
      where: { id, ...scope },
      include: expenseInclude,
    }) as Promise<ExpenseWithRelations | null>;
  }

  async findByLot(
    organizationId: string,
    lotId: string,
  ): Promise<ExpenseWithRelations[]> {
    const scope = this.requireOrg(organizationId);

    return this.db.expense.findMany({
      where: { lotId, ...scope },
      include: expenseInclude,
      orderBy: { date: "desc" },
    }) as Promise<ExpenseWithRelations[]>;
  }

  async create(
    organizationId: string,
    data: CreateExpenseInput,
  ): Promise<ExpenseWithRelations> {
    const scope = this.requireOrg(organizationId);

    return this.db.expense.create({
      data: {
        amount: new Prisma.Decimal(data.amount),
        category: data.category,
        description: data.description ?? null,
        date: data.date,
        lotId: data.lotId,
        createdById: data.createdById,
        organizationId: scope.organizationId,
      },
      include: expenseInclude,
    }) as Promise<ExpenseWithRelations>;
  }

  async update(
    organizationId: string,
    id: string,
    data: UpdateExpenseInput,
  ): Promise<ExpenseWithRelations> {
    const scope = this.requireOrg(organizationId);

    return this.db.expense.update({
      where: { id, ...scope },
      data: {
        ...(data.amount !== undefined && { amount: new Prisma.Decimal(data.amount) }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.date !== undefined && { date: data.date }),
      },
      include: expenseInclude,
    }) as Promise<ExpenseWithRelations>;
  }

  async delete(organizationId: string, id: string): Promise<void> {
    const scope = this.requireOrg(organizationId);

    await this.db.expense.delete({
      where: { id, ...scope },
    });
  }

  async sumByLot(organizationId: string, lotId: string): Promise<number> {
    const scope = this.requireOrg(organizationId);

    const result = await this.db.expense.aggregate({
      where: { lotId, ...scope },
      _sum: { amount: true },
    });

    return result._sum.amount?.toNumber() ?? 0;
  }

  async totalsByCategory(
    organizationId: string,
    lotId: string,
  ): Promise<ExpenseTotalByCategory[]> {
    const scope = this.requireOrg(organizationId);

    const results = await this.db.expense.groupBy({
      by: ["category"],
      where: { lotId, ...scope },
      _sum: { amount: true },
      orderBy: { category: "asc" },
    });

    return results.map((r) => ({
      category: r.category,
      total: r._sum.amount?.toNumber() ?? 0,
    }));
  }
}
