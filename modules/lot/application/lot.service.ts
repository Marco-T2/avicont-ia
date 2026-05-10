import { NotFoundError } from "@/features/shared/errors";
import {
  Lot,
  type CreateLotInput,
  type CloseLotInput,
} from "../domain/lot.entity";
import type { LotRepository } from "../domain/lot.repository";
import type { LotSummary } from "../domain/value-objects/lot-summary";

export type CreateLotServiceInput = Omit<CreateLotInput, "organizationId">;

export class LotService {
  constructor(private readonly repo: LotRepository) {}

  async list(organizationId: string): Promise<Lot[]> {
    return this.repo.findAll(organizationId);
  }

  async listByFarm(organizationId: string, farmId: string): Promise<Lot[]> {
    return this.repo.findByFarm(organizationId, farmId);
  }

  async getById(organizationId: string, id: string): Promise<Lot> {
    const found = await this.repo.findById(organizationId, id);
    if (!found) throw new NotFoundError("Lote");
    return found;
  }

  async create(
    organizationId: string,
    input: CreateLotServiceInput,
  ): Promise<Lot> {
    const lot = Lot.create({ ...input, organizationId });
    await this.repo.save(lot);
    return lot;
  }

  async close(
    organizationId: string,
    id: string,
    input: CloseLotInput,
  ): Promise<Lot> {
    const lot = await this.getById(organizationId, id);
    const closed = lot.close(input.endDate);
    await this.repo.update(closed);
    return closed;
  }

  async getSummary(
    organizationId: string,
    id: string,
  ): Promise<{ lot: Lot; summary: LotSummary }> {
    const found = await this.repo.findByIdWithRelations(organizationId, id);
    if (!found) throw new NotFoundError("Lote");
    const summary = found.lot.computeSummary(
      found.expenses,
      found.mortalityLogs,
    );
    return { lot: found.lot, summary };
  }
}
