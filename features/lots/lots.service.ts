import "server-only";
import { NotFoundError, ValidationError } from "@/features/shared/errors";
import { LotsRepository } from "./lots.repository";
import type {
  CreateLotInput,
  CloseLotInput,
  LotSummary,
} from "./lots.types";
import type { ChickenLot } from "@/generated/prisma/client";

export class LotsService {
  private readonly repo: LotsRepository;

  constructor(repo?: LotsRepository) {
    this.repo = repo ?? new LotsRepository();
  }

  // ── List all lots in the organization ──

  async list(organizationId: string): Promise<ChickenLot[]> {
    return this.repo.findAll(organizationId);
  }

  // ── List lots for a specific farm ──

  async listByFarm(
    organizationId: string,
    farmId: string,
  ): Promise<ChickenLot[]> {
    return this.repo.findByFarm(organizationId, farmId);
  }

  // ── Get a single lot ──

  async getById(organizationId: string, id: string): Promise<ChickenLot> {
    const lot = await this.repo.findById(organizationId, id);
    if (!lot) throw new NotFoundError("Lote");
    return lot;
  }

  // ── Create a new lot (defaults to ACTIVE) ──

  async create(
    organizationId: string,
    input: CreateLotInput,
  ): Promise<ChickenLot> {
    return this.repo.create(organizationId, input);
  }

  // ── Close an active lot ──

  async close(
    organizationId: string,
    id: string,
    input: CloseLotInput,
  ): Promise<ChickenLot> {
    const lot = await this.repo.findById(organizationId, id);
    if (!lot) throw new NotFoundError("Lote");

    if (lot.status !== "ACTIVE") {
      throw new ValidationError("Solo se pueden cerrar lotes activos");
    }

    return this.repo.close(organizationId, id, input.endDate);
  }

  // ── Get lot summary with computed metrics ──

  async getSummary(organizationId: string, id: string): Promise<LotSummary> {
    const lot = await this.repo.findByIdWithRelations(organizationId, id);
    if (!lot) throw new NotFoundError("Lote");

    const totalExpenses = lot.expenses.reduce(
      (sum, expense) => sum + Number(expense.amount),
      0,
    );

    const totalMortality = lot.mortalityLogs.reduce(
      (sum, log) => sum + log.count,
      0,
    );

    const aliveCount = lot.initialCount - totalMortality;

    const costPerChicken = aliveCount > 0 ? totalExpenses / aliveCount : 0;

    return {
      lot,
      totalExpenses,
      totalMortality,
      aliveCount,
      costPerChicken,
    };
  }
}
