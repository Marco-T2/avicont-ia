import { prisma } from "@/lib/prisma";
import { NotFoundError, ValidationError } from "@/features/shared/errors";
import { MortalityRepository } from "./mortality.repository";
import type {
  LogMortalityInput,
  MortalityLogWithRelations,
} from "./mortality.types";

export class MortalityService {
  private readonly repo: MortalityRepository;

  constructor(repo?: MortalityRepository) {
    this.repo = repo ?? new MortalityRepository();
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
    const lot = await prisma.chickenLot.findFirst({
      where: { id: input.lotId, organizationId },
    });

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
