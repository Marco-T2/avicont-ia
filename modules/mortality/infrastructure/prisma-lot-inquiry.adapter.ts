import "server-only";
import { LotsService } from "@/features/lots/server";
import { NotFoundError } from "@/features/shared/errors";
import type { LotInquiryPort, LotSnapshot } from "../domain/lot-inquiry.port";

export class PrismaLotInquiryAdapter implements LotInquiryPort {
  constructor(private readonly lots: LotsService = new LotsService()) {}

  async findById(organizationId: string, lotId: string): Promise<LotSnapshot | null> {
    try {
      const lot = await this.lots.getById(organizationId, lotId);
      return { id: lot.id, initialCount: lot.initialCount };
    } catch (err) {
      if (err instanceof NotFoundError) return null;
      throw err;
    }
  }
}
