import "server-only";
import { ValidationError } from "@/features/shared/errors";
import { MortalityRepository } from "./mortality.repository";
import { LotsService } from "@/features/lots/server";
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

  // ── Listar registros de mortalidad de un lote ──

  async listByLot(
    organizationId: string,
    lotId: string,
  ): Promise<MortalityLogWithRelations[]> {
    return this.repo.findByLot(organizationId, lotId);
  }

  // ── Registrar mortalidad ──

  async log(
    organizationId: string,
    input: LogMortalityInput,
  ): Promise<MortalityLogWithRelations> {
    // Obtener el lote para conocer initialCount (lanza NotFoundError si no existe)
    const lot = await this.lotsService.getById(organizationId, input.lotId);

    // Obtener la mortalidad total acumulada para este lote
    const totalMortality = await this.repo.countByLot(organizationId, input.lotId);

    const aliveCount = lot.initialCount - totalMortality;

    if (input.count > aliveCount) {
      throw new ValidationError(
        `La cantidad excede los pollos vivos en el lote (${aliveCount} disponibles)`,
      );
    }

    return this.repo.create(organizationId, input);
  }

  // ── Obtener mortalidad total de un lote ──

  async getTotalByLot(organizationId: string, lotId: string): Promise<number> {
    return this.repo.countByLot(organizationId, lotId);
  }
}
