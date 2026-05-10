import "server-only";
import { NotFoundError } from "@/features/shared/errors";
import { FarmService } from "../application/farm.service";
import { PrismaFarmRepository } from "./prisma-farm.repository";
import { LocalMemberInquiryAdapter } from "./local-member-inquiry.adapter";
import type {
  FarmInquiryPort,
  FarmSnapshot,
} from "../domain/ports/farm-inquiry.port";

export class LocalFarmInquiryAdapter implements FarmInquiryPort {
  constructor(
    private readonly farms: FarmService = new FarmService(
      new PrismaFarmRepository(),
      new LocalMemberInquiryAdapter(),
    ),
  ) {}

  async list(
    organizationId: string,
    filters?: { memberId?: string },
  ): Promise<FarmSnapshot[]> {
    const items = await this.farms.list(organizationId, filters);
    return items.map((f) => f.toSnapshot());
  }

  async findById(
    organizationId: string,
    farmId: string,
  ): Promise<FarmSnapshot | null> {
    try {
      const farm = await this.farms.getById(organizationId, farmId);
      return farm.toSnapshot();
    } catch (err) {
      if (err instanceof NotFoundError) return null;
      throw err;
    }
  }
}
