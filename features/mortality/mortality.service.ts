import { ValidationError } from "@/features/shared/errors";
import { MortalityRepository } from "./mortality.repository";
import { LotsService } from "@/features/lots/lots.service";
import type {
  LogMortalityInput,
  MortalityLogWithRelations,
} from "./mortality.types";

export class MortalityService {
  private readonly repo: MortalityRepository;
  private readonly lotsService: LotsService;

  constructor(repo?: MortalityRepository, lotsService?: LotsService) {
    this.repo = repo ?? new MortalityRepository();
    this.lotsService = lotsService ?? new LotsService();
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
    // Fetch the lot to get initialCount (throws NotFoundError if missing)
    const lot = await this.lotsService.getById(organizationId, input.lotId);

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
