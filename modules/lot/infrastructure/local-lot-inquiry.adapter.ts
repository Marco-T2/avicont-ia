import "server-only";
import { NotFoundError } from "@/modules/shared/domain/errors";
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

  /**
   * REQ-204 / D-8: org-wide flat list, optionally narrowed by free-
   * text `farmName`. The repository no longer groups by farm — UI
   * client-side filters per REQ-205 autocomplete. Filter case-insens
   * exact match to mirror how the UI builds the datalist.
   */
  async list(
    organizationId: string,
    filters?: { farmName?: string },
  ): Promise<LotSnapshot[]> {
    const items = await this.lots.list(organizationId);
    const snaps = items.map((l) => l.toSnapshot());
    if (!filters?.farmName) return snaps;
    const needle = filters.farmName.trim().toLowerCase();
    return snaps.filter((s) => s.farmName.toLowerCase() === needle);
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
