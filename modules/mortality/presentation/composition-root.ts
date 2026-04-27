import "server-only";
import { MortalityService } from "../application/mortality.service";
import { PrismaMortalityRepository } from "../infrastructure/prisma-mortality.repository";
import { LotInquiryAdapter } from "../infrastructure/prisma-lot-inquiry.adapter";

export function makeMortalityService(): MortalityService {
  return new MortalityService(
    new PrismaMortalityRepository(),
    new LotInquiryAdapter(),
  );
}
