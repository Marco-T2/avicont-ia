import "server-only";
import { LotService } from "../application/lot.service";
import { PrismaLotRepository } from "../infrastructure/prisma-lot.repository";

export { PrismaLotRepository };

export function makeLotService(): LotService {
  return new LotService(new PrismaLotRepository());
}

export function makeLotRepository(): PrismaLotRepository {
  return new PrismaLotRepository();
}
