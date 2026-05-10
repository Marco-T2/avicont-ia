import "server-only";
import { FarmService } from "../application/farm.service";
import { PrismaFarmRepository } from "../infrastructure/prisma-farm.repository";
import { LocalMemberInquiryAdapter } from "../infrastructure/local-member-inquiry.adapter";

export { PrismaFarmRepository };

export function makeFarmService(): FarmService {
  return new FarmService(
    new PrismaFarmRepository(),
    new LocalMemberInquiryAdapter(),
  );
}

export function makeFarmRepository(): PrismaFarmRepository {
  return new PrismaFarmRepository();
}
