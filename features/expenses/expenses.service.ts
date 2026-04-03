import { NotFoundError } from "@/features/shared/errors";
import { ExpensesRepository } from "./expenses.repository";
import type {
  CreateExpenseInput,
  ExpenseFilters,
  ExpenseTotalByCategory,
  ExpenseWithRelations,
} from "./expenses.types";

export class ExpensesService {
  private readonly repo: ExpensesRepository;

  constructor(repo?: ExpensesRepository) {
    this.repo = repo ?? new ExpensesRepository();
  }

  // ── List expenses with optional filters ──

  async list(
    organizationId: string,
    filters?: ExpenseFilters,
  ): Promise<ExpenseWithRelations[]> {
    return this.repo.findAll(organizationId, filters);
  }

  // ── Get a single expense by id ──

  async getById(
    organizationId: string,
    id: string,
  ): Promise<ExpenseWithRelations | null> {
    return this.repo.findById(organizationId, id);
  }

  // ── List expenses for a specific lot ──

  async listByLot(
    organizationId: string,
    lotId: string,
  ): Promise<ExpenseWithRelations[]> {
    return this.repo.findByLot(organizationId, lotId);
  }

  // ── Create an expense ──

  async create(
    organizationId: string,
    input: CreateExpenseInput,
  ): Promise<ExpenseWithRelations> {
    return this.repo.create(organizationId, input);
  }

  // ── Delete an expense ──

  async delete(organizationId: string, id: string): Promise<void> {
    const expense = await this.repo.findById(organizationId, id);
    if (!expense) throw new NotFoundError("Gasto");

    await this.repo.delete(organizationId, id);
  }

  // ── Get total expenses for a lot ──

  async getTotalByLot(organizationId: string, lotId: string): Promise<number> {
    return this.repo.sumByLot(organizationId, lotId);
  }

  // ── Get totals grouped by category for a lot ──

  async getTotalsByCategory(
    organizationId: string,
    lotId: string,
  ): Promise<ExpenseTotalByCategory[]> {
    return this.repo.totalsByCategory(organizationId, lotId);
  }
}
