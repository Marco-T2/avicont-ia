import "server-only";
import { NotFoundError } from "@/features/shared/errors";
import { LotService } from "../application/lot.service";
import { PrismaLotRepository } from "./prisma-lot.repository";
import type {
  LotInquiryPort,
  LotSnapshot,
} from "../domain/ports/lot-inquiry.port";

export class LocalLotInquiryAdapter implements LotInquiryPort {
  constructor(
    private readonly lots: LotService = new LotService(new PrismaLotRepository()),
  ) {}

  async list(
    organizationId: string,
    filters?: { farmId?: string },
  ): Promise<LotSnapshot[]> {
    const items = filters?.farmId
      ? await this.lots.listByFarm(organizationId, filters.farmId)
      : await this.lots.list(organizationId);
    return items.map((l) => l.toSnapshot());
  }

  async findById(
    organizationId: string,
    lotId: string,
  ): Promise<LotSnapshot | null> {
    try {
      const lot = await this.lots.getById(organizationId, lotId);
      return lot.toSnapshot();
    } catch (err) {
      if (err instanceof NotFoundError) return null;
      throw err;
    }
  }
}
