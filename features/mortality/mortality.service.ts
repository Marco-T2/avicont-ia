import { NotFoundError, ValidationError } from "@/features/shared/errors";
import { MortalityRepository } from "./mortality.repository";
import { LotsRepository } from "@/features/lots/lots.repository";
import type {
  LogMortalityInput,
  MortalityLogWithRelations,
} from "./mortality.types";

export class MortalityService {
  private readonly repo: MortalityRepository;
  private readonly lotsRepo: LotsRepository;

  constructor(repo?: MortalityRepository, lotsRepo?: LotsRepository) {
    this.repo = repo ?? new MortalityRepository();
    this.lotsRepo = lotsRepo ?? new LotsRepository();
  }

  // ── List mortality logs for a lot ──

  async listByLot(
    organizationId: string,
    lotId: string,
  ): Promise<MortalityLogWithRelations[]> {
    return this.repo.findByLot(organizationId, lotId);
  }

  // ── Log mortality ──

  async log(
    organizationId: string,
    input: LogMortalityInput,
  ): Promise<MortalityLogWithRelations> {
    // Fetch the lot to get initialCount
    const lot = await this.lotsRepo.findById(organizationId, input.lotId);

    if (!lot) {
      throw new NotFoundError("Lote");
    }

    // Get existing total mortality for this lot
    const totalMortality = await this.repo.countByLot(organizationId, input.lotId);

    const aliveCount = lot.initialCount - totalMortality;

    if (input.count > aliveCount) {
      throw new ValidationError(
        `La cantidad excede los pollos vivos en el lote (${aliveCount} disponibles)`,
      );
    }

    return this.repo.create(organizationId, input);
  }

  // ── Get total mortality for a lot ──

  async getTotalByLot(organizationId: string, lotId: string): Promise<number> {
    return this.repo.countByLot(organizationId, lotId);
  }
}
