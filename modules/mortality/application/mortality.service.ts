import { NotFoundError } from "@/features/shared/errors";
import type { MortalityRepository } from "../domain/mortality.repository";
import type { LotInquiryPort } from "../domain/lot-inquiry.port";
import { Mortality } from "../domain/mortality.entity";
import { MortalityNotFound } from "../domain/errors/mortality-errors";

export interface LogMortalityInput {
  lotId: string;
  count: number;
  cause?: string;
  date: Date;
  createdById: string;
}

export interface UpdateMortalityServiceInput {
  count?: number;
  cause?: string | null;
  date?: Date;
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

  /**
   * Updates count/cause/date on an existing log. Recomputes the
   * aliveCount excluding this log's OLD count so the new count is
   * validated as if this log were brand new:
   *   aliveCountForUpdate = lot.initialCount - (totalAllLogs - oldLogCount)
   * Throws MortalityCountExceedsAlive if newCount > aliveCountForUpdate.
   * Spec REQ-105, design D-5.
   */
  async update(
    organizationId: string,
    id: string,
    input: UpdateMortalityServiceInput,
  ): Promise<Mortality> {
    const existing = await this.repo.findById(organizationId, id);
    if (!existing) throw new MortalityNotFound(id);

    const lot = await this.lots.findById(organizationId, existing.lotId);
    if (!lot) throw new NotFoundError("Lote");

    const totalAllLogs = await this.repo.countByLot(
      organizationId,
      existing.lotId,
    );
    const oldCount = existing.count.value;
    const aliveCountForUpdate = lot.initialCount - (totalAllLogs - oldCount);

    const updated = existing.update({
      ...input,
      aliveCountInLot: aliveCountForUpdate,
    });
    await this.repo.update(updated);
    return updated;
  }

  async getTotalByLot(organizationId: string, lotId: string): Promise<number> {
    return this.repo.countByLot(organizationId, lotId);
  }
}
