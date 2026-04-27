import { NotFoundError } from "@/features/shared/errors";
import type { MortalityRepository } from "../domain/mortality.repository";
import type { LotInquiryPort } from "../domain/lot-inquiry.port";
import { Mortality } from "../domain/mortality.entity";

export interface LogMortalityInput {
  lotId: string;
  count: number;
  cause?: string;
  date: Date;
  createdById: string;
}

export class MortalityService {
  constructor(
    private readonly repo: MortalityRepository,
    private readonly lots: LotInquiryPort,
  ) {}

  async listByLot(organizationId: string, lotId: string): Promise<Mortality[]> {
    return this.repo.findByLot(organizationId, lotId);
  }

  async log(organizationId: string, input: LogMortalityInput): Promise<Mortality> {
    const lot = await this.lots.findById(organizationId, input.lotId);
    if (!lot) throw new NotFoundError("Lote");

    const totalDead = await this.repo.countByLot(organizationId, input.lotId);

    const mortality = Mortality.log({
      ...input,
      organizationId,
      aliveCountInLot: lot.initialCount - totalDead,
    });

    await this.repo.save(mortality);
    return mortality;
  }

  async getTotalByLot(organizationId: string, lotId: string): Promise<number> {
    return this.repo.countByLot(organizationId, lotId);
  }
}
